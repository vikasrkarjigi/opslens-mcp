"""Pydantic schemas shared across the API and the orchestrator."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class AgentRole(str, Enum):
    DATA = "data_agent"
    PATTERN = "pattern_agent"
    HYPOTHESIS = "hypothesis_agent"
    SAFETY = "safety_critic"
    SYNTHESIS = "synthesis_agent"


class IncidentRequest(BaseModel):
    incident_id: str = Field(..., description="Operator-supplied incident identifier")
    asset_id: str = Field(..., description="Equipment / asset identifier, e.g. PUMP-204")
    description: str = Field(..., description="Free-text operator description of the symptom")
    site: str = Field(default="PLANT-1")
    reported_at: datetime = Field(default_factory=datetime.utcnow)


class ToolCall(BaseModel):
    tool: str
    arguments: dict[str, Any] = {}
    requested_by: AgentRole
    approved: bool = True
    rejection_reason: str | None = None
    result: Any | None = None
    duration_ms: float | None = None
    risk_level: Literal["low", "medium", "high", "unknown"] = "unknown"
    access: Literal["read", "draft-only", "write", "unknown"] = "unknown"


class AgentMessage(BaseModel):
    role: AgentRole
    round: int
    content: str
    tool_calls: list[ToolCall] = []
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class Hypothesis(BaseModel):
    summary: str
    likelihood: float = Field(ge=0.0, le=1.0)
    evidence: list[str] = []
    contradicting_evidence: list[str] = []


SafetyStatus = Literal["CLEAR_TO_PROCEED", "CAUTION_REQUIRED", "DO_NOT_RESTART"]


class SafetyVerdict(BaseModel):
    status: SafetyStatus = "CAUTION_REQUIRED"
    approved: bool = True  # legacy convenience: True unless DO_NOT_RESTART
    blocking_concerns: list[str] = []
    cautions: list[str] = []
    required_human_checks: list[str] = []
    cited_sops: list[str] = []


class HumanReviewItem(BaseModel):
    label: str
    rationale: str
    severity: Literal["info", "caution", "critical"] = "caution"


class CAPADraft(BaseModel):
    incident_id: str
    draft_status: str
    root_cause: str
    corrective_actions: list[str] = []
    preventive_actions: list[str] = []
    approvals_required: list[str] = []


class DemoIncident(BaseModel):
    incident_id: str
    title: str
    asset_id: str
    site: str
    shift: str
    reporter: str
    reported_at: datetime
    status: str
    affected_batch: str | None = None
    description: str
    severity_hint: Literal["info", "caution", "critical"] = "caution"


class RCAReport(BaseModel):
    incident_id: str
    asset_id: str
    started_at: datetime
    completed_at: datetime
    top_hypothesis: Hypothesis
    alternative_hypotheses: list[Hypothesis] = []
    confidence: float
    known_unknowns: list[str] = []
    safety: SafetyVerdict
    human_review_checklist: list[HumanReviewItem] = []
    capa_draft: CAPADraft | None = None
    transcript: list[AgentMessage] = []
    tool_log: list[ToolCall] = []


class StreamEvent(BaseModel):
    type: Literal[
        "agent_start",
        "agent_message",
        "tool_call",
        "tool_result",
        "tool_blocked",
        "round_complete",
        "report_ready",
        "error",
    ]
    payload: dict[str, Any]
