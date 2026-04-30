"""Visible Safety Gateway - sits between every agent and every tool call.

Every tool invocation flows through `SafetyGateway.invoke()`, which:
  1. Validates the tool name + arguments against an allow-list.
  2. Applies per-tool guard rules (e.g. block diagnostic checks on unknown
     assets, never reveal more than 168h of data without an explicit reason,
     refuse to bypass safety protocols).
  3. Records the decision in an audit trail returned to the orchestrator
     so the UI can render the gateway's reasoning.

The gateway is *not* an LLM - it is a deterministic policy layer that the
LLM agents cannot override. This is the design point that makes OpsLens
auditable.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Callable

from mcp_server.tools import tool_metadata

from .schemas import AgentRole, ToolCall

ALLOWED_TOOLS = {
    "query_sensor_data",
    "get_maintenance_history",
    "search_incident_database",
    "fetch_equipment_specs",
    "run_diagnostic_check",
    "get_safety_protocols",
    "search_sop",
    "generate_capa_draft",
}

# Tools each agent role is allowed to invoke.
ROLE_PERMISSIONS: dict[AgentRole, set[str]] = {
    AgentRole.DATA: {"query_sensor_data", "fetch_equipment_specs", "get_maintenance_history"},
    AgentRole.PATTERN: {"query_sensor_data", "search_incident_database", "run_diagnostic_check"},
    AgentRole.HYPOTHESIS: {"search_incident_database", "fetch_equipment_specs", "run_diagnostic_check"},
    AgentRole.SAFETY: {"get_safety_protocols", "fetch_equipment_specs", "search_sop"},
    AgentRole.SYNTHESIS: set(ALLOWED_TOOLS),  # may invoke generate_capa_draft for the final report
}


@dataclass
class GatewayDecision:
    approved: bool
    reason: str | None = None
    redactions: list[str] = field(default_factory=list)


class SafetyGateway:
    """Deterministic policy layer in front of the MCP toolbelt."""

    def __init__(self, executor: Callable[[str, dict[str, Any]], Any]):
        self._executor = executor
        self.audit: list[ToolCall] = []

    # ---- policy ----------------------------------------------------------
    def _check(self, tool: str, args: dict[str, Any], role: AgentRole) -> GatewayDecision:
        if tool not in ALLOWED_TOOLS:
            return GatewayDecision(False, f"tool '{tool}' is not in the allow-list")
        if tool not in ROLE_PERMISSIONS.get(role, set()):
            return GatewayDecision(False, f"role {role.value} cannot call {tool}")

        # Hard limits
        if tool == "query_sensor_data":
            hours = int(args.get("hours", 72) or 72)
            if hours > 168:
                return GatewayDecision(
                    False,
                    "request exceeds 168h sensor window without justification",
                )
        if tool == "run_diagnostic_check" and not args.get("asset_id"):
            return GatewayDecision(False, "diagnostic check requires asset_id")

        # Safety override attempts
        if any("override" in str(v).lower() or "bypass" in str(v).lower() for v in args.values()):
            return GatewayDecision(False, "explicit override/bypass language is not permitted")

        return GatewayDecision(True)

    # ---- entry-point -----------------------------------------------------
    def invoke(self, tool: str, args: dict[str, Any], role: AgentRole) -> ToolCall:
        decision = self._check(tool, args, role)
        meta = tool_metadata(tool)
        record = ToolCall(
            tool=tool,
            arguments=args,
            requested_by=role,
            approved=decision.approved,
            risk_level=meta["risk"],
            access=meta["access"],
        )
        if not decision.approved:
            record.rejection_reason = decision.reason
            self.audit.append(record)
            return record

        t0 = time.perf_counter()
        try:
            record.result = self._executor(tool, args)
        except Exception as e:  # pragma: no cover - executor must not crash gateway
            record.approved = False
            record.rejection_reason = f"executor error: {e}"
        record.duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        self.audit.append(record)
        return record
