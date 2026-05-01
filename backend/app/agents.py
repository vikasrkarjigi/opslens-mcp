"""Multi-agent layer for OpsLens MCP.

Five specialised agents collaborate (and challenge each other) on every
incident.  Each agent inherits from `BaseAgent`, which knows how to:

  * route every tool call through the SafetyGateway,
  * call Anthropic Claude when an API key is present, and
  * fall back to deterministic mock reasoning so the system runs
    end-to-end on a fresh laptop with zero credentials.

The agents are intentionally small and rule-driven in mock mode - the
goal is a transparent, auditable trace, not a black box.
"""
from __future__ import annotations

import json
import os
import textwrap
from dataclasses import dataclass
from typing import Any

from .config import settings
from .safety_gateway import SafetyGateway
from .schemas import AgentMessage, AgentRole, Hypothesis, SafetyVerdict, ToolCall


# ---------------------------------------------------------------------------
# Anthropic helper (lazy + graceful fallback)
# ---------------------------------------------------------------------------
def _anthropic_client():
    if settings.use_mock_llm:
        return None
    try:
        import anthropic

        return anthropic.Anthropic(api_key=settings.anthropic_api_key)
    except Exception:
        return None


_CLIENT = _anthropic_client()


def _llm_reason(system: str, user: str) -> str:
    """Single-turn Claude call. Returns plain text; uses mock if no key."""
    if _CLIENT is None:
        return ""  # caller will use deterministic fallback
    try:
        msg = _CLIENT.messages.create(
            model=settings.anthropic_model,
            max_tokens=600,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return "".join(getattr(b, "text", "") for b in msg.content)
    except Exception as e:
        return f"[llm-error: {e}]"


# ---------------------------------------------------------------------------
# Base agent
# ---------------------------------------------------------------------------
@dataclass
class AgentContext:
    incident_id: str
    asset_id: str
    description: str
    shared_findings: dict[str, Any]
    transcript: list[AgentMessage]


class BaseAgent:
    role: AgentRole = AgentRole.DATA  # overridden
    system_prompt: str = ""

    def __init__(self, gateway: SafetyGateway):
        self.gateway = gateway

    # ------- tool helper -------
    def call_tool(self, tool: str, **arguments: Any) -> ToolCall:
        return self.gateway.invoke(tool, arguments, self.role)

    # ------- reasoning helper -------
    def reason(self, ctx: AgentContext, evidence: dict[str, Any]) -> str:
        if _CLIENT is None:
            return self._mock_reason(ctx, evidence)
        prompt = textwrap.dedent(
            f"""
            Incident: {ctx.incident_id}
            Asset: {ctx.asset_id}
            Operator description: {ctx.description}

            Shared findings so far (JSON):
            {json.dumps(ctx.shared_findings, indent=2, default=str)[:6000]}

            Your fresh evidence (JSON):
            {json.dumps(evidence, indent=2, default=str)[:6000]}

            Respond with 4-6 short bullet points stating what YOU conclude
            from this evidence, what you are uncertain about, and what you
            disagree with from prior agents (if anything). Be terse.
            """
        ).strip()
        return _llm_reason(self.system_prompt, prompt) or self._mock_reason(ctx, evidence)

    # ------- subclasses override -------
    def run(self, ctx: AgentContext, round_num: int) -> AgentMessage:  # pragma: no cover
        raise NotImplementedError

    def _mock_reason(self, ctx: AgentContext, evidence: dict[str, Any]) -> str:
        return f"[{self.role.value}] no LLM available; see structured evidence."


# ---------------------------------------------------------------------------
# Concrete agents
# ---------------------------------------------------------------------------
class DataAgent(BaseAgent):
    role = AgentRole.DATA
    system_prompt = (
        "You are the Data Agent. You only report what the sensors and the "
        "maintenance log actually say. You never speculate about causes."
    )

    def run(self, ctx: AgentContext, round_num: int) -> AgentMessage:
        sensors = self.call_tool("query_sensor_data", asset_id=ctx.asset_id, hours=72)
        specs = self.call_tool("fetch_equipment_specs", asset_id=ctx.asset_id)
        maint = self.call_tool("get_maintenance_history", asset_id=ctx.asset_id)
        evidence = {"sensors": sensors.result, "specs": specs.result, "maintenance": maint.result}
        ctx.shared_findings["data"] = evidence

        bullets = self._mock_reason(ctx, evidence) if _CLIENT is None else self.reason(ctx, evidence)
        confidence = 0.85 if isinstance(sensors.result, dict) and "stats" in (sensors.result or {}) else 0.4
        return AgentMessage(
            role=self.role,
            round=round_num,
            content=bullets,
            tool_calls=[sensors, specs, maint],
            confidence=confidence,
        )

    def _mock_reason(self, ctx: AgentContext, evidence: dict[str, Any]) -> str:
        stats = (evidence.get("sensors") or {}).get("stats", {})
        lines = ["Sensor delta vs baseline (last 72h):"]
        for metric, s in stats.items():
            lines.append(f"  - {metric}: recent_mean={s['recent_mean']} (Δ {s['delta_pct']}%)")
        spec = evidence.get("specs") or {}
        lines.append(f"Asset class: {spec.get('class', 'unknown')} ({spec.get('manufacturer', '?')} {spec.get('model', '?')})")
        maint = (evidence.get("maintenance") or {}).get("entries", [])
        if maint:
            lines.append(f"Most recent work-order: {maint[-1]['date']} - {maint[-1]['action']} [{maint[-1]['status']}]")
        return "\n".join(lines)


class PatternAgent(BaseAgent):
    role = AgentRole.PATTERN
    system_prompt = (
        "You are the Pattern Agent. You compare current sensor anomalies against "
        "the fleet incident history and identify the closest analogues."
    )

    def run(self, ctx: AgentContext, round_num: int) -> AgentMessage:
        diag = self.call_tool("run_diagnostic_check", asset_id=ctx.asset_id)
        # Build a query from operator description + flagged metrics
        flagged = [f["metric"] for f in (diag.result or {}).get("findings", [])] if isinstance(diag.result, dict) else []
        query = " ".join([ctx.description] + flagged)
        matches = self.call_tool(
            "search_incident_database",
            query=query,
            asset_class=(ctx.shared_findings.get("data", {}).get("specs") or {}).get("class"),
        )
        evidence = {"diagnostic": diag.result, "historical_matches": matches.result}
        ctx.shared_findings["pattern"] = evidence
        bullets = self.reason(ctx, evidence)
        n_findings = len((diag.result or {}).get("findings", [])) if isinstance(diag.result, dict) else 0
        confidence = min(0.4 + 0.15 * n_findings, 0.9)
        return AgentMessage(
            role=self.role,
            round=round_num,
            content=bullets,
            tool_calls=[diag, matches],
            confidence=confidence,
        )

    def _mock_reason(self, ctx: AgentContext, evidence: dict[str, Any]) -> str:
        lines = ["Diagnostic findings:"]
        for f in (evidence.get("diagnostic") or {}).get("findings", []):
            lines.append(f"  - {f['metric']} {f['recent']} vs limit {f['limit']} ({f['severity']})")
        matches = (evidence.get("historical_matches") or {}).get("matches", [])
        if matches:
            lines.append("Closest historical analogues:")
            for m in matches[:3]:
                lines.append(f"  - {m['incident_id']}: {m['root_cause']}")
        else:
            lines.append("No close historical analogue - treat as novel.")
        return "\n".join(lines)


class HypothesisAgent(BaseAgent):
    role = AgentRole.HYPOTHESIS
    system_prompt = (
        "You are the Hypothesis Agent. You propose 2-3 candidate root causes "
        "with explicit likelihoods and the evidence that would falsify each."
    )

    def run(self, ctx: AgentContext, round_num: int) -> AgentMessage:
        # No fresh tool call usually needed - reason over shared findings.
        evidence = {"shared": ctx.shared_findings}
        bullets = self.reason(ctx, evidence)
        ctx.shared_findings["hypotheses"] = self._build_hypotheses(ctx)
        return AgentMessage(
            role=self.role,
            round=round_num,
            content=bullets,
            confidence=0.7,
        )

    def _build_hypotheses(self, ctx: AgentContext) -> list[dict[str, Any]]:
        diag = (ctx.shared_findings.get("pattern") or {}).get("diagnostic") or {}
        matches = ((ctx.shared_findings.get("pattern") or {}).get("historical_matches") or {}).get("matches", [])
        hyps: list[dict[str, Any]] = []
        seen: set[str] = set()
        for m in matches[:3]:
            cause = m["root_cause"]
            if cause in seen:
                continue
            seen.add(cause)
            hyps.append(
                Hypothesis(
                    summary=cause,
                    likelihood=round(0.65 - 0.15 * len(hyps), 2),
                    evidence=[f"matches {m['incident_id']} on {', '.join(m['symptoms'])}"]
                    + [f"diagnostic flag: {f['metric']} ({f['severity']})" for f in diag.get("findings", [])][:2],
                    contradicting_evidence=[],
                ).model_dump()
            )
        if not hyps:
            hyps.append(
                Hypothesis(
                    summary="Unknown - insufficient analogues; recommend on-site inspection.",
                    likelihood=0.4,
                    evidence=["no strong historical match"],
                ).model_dump()
            )
        return hyps

    def _mock_reason(self, ctx: AgentContext, evidence: dict[str, Any]) -> str:
        hyps = self._build_hypotheses(ctx)
        return "\n".join(
            f"H{i+1} (p={h['likelihood']}): {h['summary']}" for i, h in enumerate(hyps)
        )


class SafetyCriticAgent(BaseAgent):
    role = AgentRole.SAFETY
    system_prompt = (
        "You are the Safety Critic. Your veto cannot be overridden. You list "
        "any action in the proposed plan that violates LOTO / hot-work / "
        "pressure-isolation procedures and demand human sign-off."
    )

    # Operator-reported phrases that must trigger a hard DO_NOT_RESTART verdict.
    # These are emergency cues; mere mentions of "electrical" do not qualify
    # because most electrical findings are routine.
    DANGER_PHRASES = ("burning smell", "smoke", "arc fault", "electric shock", "shock hazard")

    def run(self, ctx: AgentContext, round_num: int) -> AgentMessage:
        proto = self.call_tool("get_safety_protocols", asset_id=ctx.asset_id)
        specs = self.call_tool("fetch_equipment_specs", asset_id=ctx.asset_id)
        # Cite the most relevant SOPs for the symptom in plain language.
        sop_query = " ".join([ctx.description] + self._symptom_keywords(ctx))
        sops = self.call_tool("search_sop", query=sop_query, limit=3)
        evidence = {"protocols": proto.result, "specs": specs.result, "sops": sops.result}
        ctx.shared_findings["safety"] = evidence
        bullets = self.reason(ctx, evidence)
        verdict = self._verdict(ctx, evidence)
        ctx.shared_findings["safety_verdict"] = verdict.model_dump()
        return AgentMessage(
            role=self.role,
            round=round_num,
            content=bullets,
            tool_calls=[proto, specs, sops],
            confidence=0.95 if verdict.status != "DO_NOT_RESTART" else 1.0,
        )

    def _symptom_keywords(self, ctx: AgentContext) -> list[str]:
        diag = (ctx.shared_findings.get("pattern") or {}).get("diagnostic") or {}
        return [f["metric"] for f in diag.get("findings", [])]

    def _verdict(self, ctx: AgentContext, evidence: dict[str, Any]) -> SafetyVerdict:
        protocols = (evidence.get("protocols") or {}).get("protocols", [])
        diag = (ctx.shared_findings.get("pattern") or {}).get("diagnostic") or {}
        findings = diag.get("findings", [])
        critical = [f for f in findings if f.get("severity") == "critical"]
        electrical_critical = any(f.get("kind") == "electrical" and f.get("severity") == "critical" for f in findings)
        desc = ctx.description.lower()
        danger_word = next((p for p in self.DANGER_PHRASES if p in desc), None)

        cautions = [f"{f['metric']} above design limit ({f['recent']} vs {f['limit']})" for f in critical]
        cited = [m["sop_id"] for m in (evidence.get("sops") or {}).get("matches", [])]

        # Decision tree. Any of these is a hard veto:
        #   1. an electrical reading already over the design limit, or
        #   2. the operator reporting a true emergency phrase (smoke, etc.).
        if electrical_critical or danger_word:
            status = "DO_NOT_RESTART"
            blocking = []
            if electrical_critical:
                blocking.append(
                    "Electrical safety threshold exceeded. Restart prohibited "
                    "until licensed electrician clears per SOP-ELEC-02."
                )
            if danger_word:
                blocking.append(
                    f"Operator reported '{danger_word}'. Escalate immediately per SOP-ELEC-02."
                )
        elif critical or "electrical" in desc:
            status = "CAUTION_REQUIRED"
            blocking = []
        else:
            status = "CLEAR_TO_PROCEED"
            blocking = []

        return SafetyVerdict(
            status=status,
            approved=status != "DO_NOT_RESTART",
            blocking_concerns=blocking,
            cautions=cautions,
            required_human_checks=protocols[:4],
            cited_sops=cited,
        )

    def _mock_reason(self, ctx: AgentContext, evidence: dict[str, Any]) -> str:
        v = self._verdict(ctx, evidence)
        lines = [f"VERDICT: {v.status}"]
        if v.blocking_concerns:
            lines.append("Blocking concerns:")
            for b in v.blocking_concerns:
                lines.append(f"  - {b}")
        if v.cited_sops:
            lines.append(f"Cited SOPs: {', '.join(v.cited_sops)}")
        lines.append("Mandatory human checks before any field action:")
        for p in v.required_human_checks:
            lines.append(f"  - {p}")
        if v.cautions:
            lines.append("Cautions:")
            for c in v.cautions:
                lines.append(f"  - {c}")
        return "\n".join(lines)


class SynthesisAgent(BaseAgent):
    role = AgentRole.SYNTHESIS
    system_prompt = (
        "You are the Synthesis Agent. You produce the final RCA report. You "
        "MUST list known unknowns and you MUST NOT contradict the Safety Critic."
    )

    def run(self, ctx: AgentContext, round_num: int) -> AgentMessage:
        evidence = ctx.shared_findings
        # Publish the structured known-unknowns list BEFORE producing narrative
        # so that the orchestrator-built checklist and the synthesis agent's
        # bullets are derived from the exact same source. This eliminates the
        # historical mismatch between the agent's reasoning text and the
        # report's `known_unknowns` field.
        ctx.shared_findings["known_unknowns"] = self._known_unknowns(evidence)
        bullets = self.reason(ctx, evidence)
        tool_calls = []

        # Draft CAPA only when the safety verdict permits restart planning.
        verdict = ctx.shared_findings.get("safety_verdict") or {}
        hyps = ctx.shared_findings.get("hypotheses") or []
        if verdict.get("status") != "DO_NOT_RESTART" and hyps:
            top = hyps[0]
            capa = self.call_tool(
                "generate_capa_draft",
                incident_id=ctx.incident_id,
                root_cause=top["summary"],
            )
            tool_calls.append(capa)
            if capa.approved and isinstance(capa.result, dict):
                ctx.shared_findings["capa_draft"] = capa.result

        return AgentMessage(
            role=self.role,
            round=round_num,
            content=bullets,
            tool_calls=tool_calls,
            confidence=self._overall_confidence(ctx),
        )

    def _overall_confidence(self, ctx: AgentContext) -> float:
        hyps = ctx.shared_findings.get("hypotheses") or []
        if not hyps:
            return 0.3
        top = max(h["likelihood"] for h in hyps)
        # Penalise if no critical diagnostic findings supported the top hypothesis
        diag = (ctx.shared_findings.get("pattern") or {}).get("diagnostic") or {}
        if not diag.get("findings"):
            top *= 0.7
        return round(min(top, 0.92), 2)

    def _known_unknowns(self, evidence: dict[str, Any]) -> list[str]:
        """Single source of truth for what the system flags as a known unknown.

        Used by the Synthesis Agent's narrative and by the orchestrator's
        checklist builder so that the agent's reasoning text and the report's
        `known_unknowns` field can never disagree.
        """
        unknowns: list[str] = []
        pattern = evidence.get("pattern") or {}
        if not (pattern.get("historical_matches") or {}).get("matches"):
            unknowns.append("No historical analogue in fleet database.")
        if not (pattern.get("diagnostic") or {}).get("findings"):
            unknowns.append(
                "No design-limit excursions detected; symptom may be sub-threshold drift."
            )
        return unknowns

    def _mock_reason(self, ctx: AgentContext, evidence: dict[str, Any]) -> str:
        hyps = ctx.shared_findings.get("hypotheses") or []
        if not hyps:
            return "Insufficient data to synthesise a root cause - escalate to on-site engineer."
        top = hyps[0]
        unknowns = self._known_unknowns(evidence)
        out = [f"Top root cause (p={top['likelihood']}): {top['summary']}"]
        if len(hyps) > 1:
            out.append("Alternatives:")
            for h in hyps[1:]:
                out.append(f"  - p={h['likelihood']}: {h['summary']}")
        if unknowns:
            out.append("Known unknowns:")
            for u in unknowns:
                out.append(f"  - {u}")
        return "\n".join(out)
