"""Multi-agent orchestrator with a debate loop.

Round 1 - every specialist runs in turn and writes to shared findings.
Round 2 - the Hypothesis and Safety agents re-run with full context so
          they can challenge or refine round-1 conclusions (this is the
          "agents debate before concluding" property).
Final  - SynthesisAgent assembles the RCA report.

The orchestrator yields `StreamEvent`s so the FastAPI layer can stream
progress to the UI over Server-Sent Events.
"""
from __future__ import annotations

from datetime import datetime
from typing import Iterator

from .agents import (
    AgentContext,
    DataAgent,
    HypothesisAgent,
    PatternAgent,
    SafetyCriticAgent,
    SynthesisAgent,
)
from .config import settings
from .mcp_client import build_client
from .safety_gateway import SafetyGateway
from .schemas import (
    AgentMessage,
    AgentRole,
    CAPADraft,
    HumanReviewItem,
    Hypothesis,
    IncidentRequest,
    RCAReport,
    SafetyVerdict,
    StreamEvent,
)


def _emit(event_type: str, payload: dict) -> StreamEvent:
    return StreamEvent(type=event_type, payload=payload)


class Orchestrator:
    def __init__(self) -> None:
        self.client = build_client()
        self.gateway = SafetyGateway(executor=self.client.call)
        self.agents = {
            AgentRole.DATA: DataAgent(self.gateway),
            AgentRole.PATTERN: PatternAgent(self.gateway),
            AgentRole.HYPOTHESIS: HypothesisAgent(self.gateway),
            AgentRole.SAFETY: SafetyCriticAgent(self.gateway),
            AgentRole.SYNTHESIS: SynthesisAgent(self.gateway),
        }

    # --------------------------------------------------------------
    def run_stream(self, req: IncidentRequest) -> Iterator[StreamEvent]:
        started = datetime.utcnow()
        ctx = AgentContext(
            incident_id=req.incident_id,
            asset_id=req.asset_id,
            description=req.description,
            shared_findings={},
            transcript=[],
        )

        round_plan = [
            (1, [AgentRole.DATA, AgentRole.PATTERN, AgentRole.HYPOTHESIS, AgentRole.SAFETY]),
        ]
        if settings.max_debate_rounds > 1:
            round_plan.append((2, [AgentRole.HYPOTHESIS, AgentRole.SAFETY]))

        for round_num, roles in round_plan:
            for role in roles:
                yield _emit("agent_start", {"role": role.value, "round": round_num})
                msg = self.agents[role].run(ctx, round_num)
                ctx.transcript.append(msg)
                for tc in msg.tool_calls:
                    yield _emit(
                        "tool_call" if tc.approved else "tool_blocked",
                        {
                            "agent": role.value,
                            "tool": tc.tool,
                            "arguments": tc.arguments,
                            "approved": tc.approved,
                            "rejection_reason": tc.rejection_reason,
                            "duration_ms": tc.duration_ms,
                        },
                    )
                    if tc.approved:
                        yield _emit(
                            "tool_result",
                            {"tool": tc.tool, "result": tc.result, "agent": role.value},
                        )
                yield _emit("agent_message", msg.model_dump(mode="json"))
            yield _emit("round_complete", {"round": round_num})

        # Final synthesis
        yield _emit("agent_start", {"role": AgentRole.SYNTHESIS.value, "round": 99})
        final = self.agents[AgentRole.SYNTHESIS].run(ctx, round_num=99)
        ctx.transcript.append(final)
        yield _emit("agent_message", final.model_dump(mode="json"))

        report = self._build_report(req, ctx, started)
        yield _emit("report_ready", report.model_dump(mode="json"))

    # --------------------------------------------------------------
    def run(self, req: IncidentRequest) -> RCAReport:
        last_report: dict | None = None
        for event in self.run_stream(req):
            if event.type == "report_ready":
                last_report = event.payload
        assert last_report is not None
        return RCAReport.model_validate(last_report)

    # --------------------------------------------------------------
    def _build_report(self, req: IncidentRequest, ctx: AgentContext, started: datetime) -> RCAReport:
        hyps_data = ctx.shared_findings.get("hypotheses") or []
        hyps = [Hypothesis.model_validate(h) for h in hyps_data]
        if not hyps:
            hyps = [Hypothesis(summary="Unknown - escalate to engineer", likelihood=0.3)]

        verdict = SafetyVerdict.model_validate(
            ctx.shared_findings.get("safety_verdict")
            or SafetyVerdict(approved=True).model_dump()
        )

        # Human review checklist - merge blocking concerns + safety protocols + diagnostic flags.
        checklist: list[HumanReviewItem] = []
        for blocker in verdict.blocking_concerns:
            checklist.append(HumanReviewItem(label=blocker, rationale="Safety Critic blocking concern", severity="critical"))
        for proto in verdict.required_human_checks:
            checklist.append(HumanReviewItem(label=proto, rationale="Mandatory safety protocol", severity="critical"))
        for caution in verdict.cautions:
            checklist.append(HumanReviewItem(label=caution, rationale="Reading exceeds design limit", severity="caution"))
        if not (ctx.shared_findings.get("pattern") or {}).get("historical_matches", {}).get("matches"):
            checklist.append(
                HumanReviewItem(
                    label="No historical analogue - confirm hypothesis on-site before parts order.",
                    rationale="Known unknown",
                    severity="caution",
                )
            )

        confidence = self.agents[AgentRole.SYNTHESIS]._overall_confidence(ctx)  # type: ignore[attr-defined]

        capa_payload = ctx.shared_findings.get("capa_draft")
        capa = CAPADraft.model_validate(capa_payload) if capa_payload else None

        return RCAReport(
            incident_id=req.incident_id,
            asset_id=req.asset_id,
            started_at=started,
            completed_at=datetime.utcnow(),
            top_hypothesis=hyps[0],
            alternative_hypotheses=hyps[1:],
            confidence=confidence,
            known_unknowns=[c.label for c in checklist if c.severity == "caution"],
            safety=verdict,
            human_review_checklist=checklist,
            capa_draft=capa,
            transcript=ctx.transcript,
            tool_log=self.gateway.audit,
        )
