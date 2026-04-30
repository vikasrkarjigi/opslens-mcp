"""Quick end-to-end smoke test.

Run from the `backend/` directory:
    python -m tests.smoke_test
"""
from __future__ import annotations

import json

from app.orchestrator import Orchestrator
from app.schemas import IncidentRequest


def _run(incident: IncidentRequest):
    return Orchestrator().run(incident)


def main() -> None:
    # Scenario 1: vibration / bearing - should produce a verdict, CAPA draft generated.
    report = _run(
        IncidentRequest(
            incident_id="DEMO-001",
            asset_id="PUMP-204",
            description="Vibration trending up; bearing temperature elevated since Sunday.",
        )
    )
    print(f"[DEMO-001] Top hypothesis (p={report.top_hypothesis.likelihood}): {report.top_hypothesis.summary}")
    print(f"[DEMO-001] Confidence: {report.confidence}  Verdict: {report.safety.status}")
    print(f"[DEMO-001] Tool calls executed: {len(report.tool_log)}")
    blocked = [t for t in report.tool_log if not t.approved]
    print(f"[DEMO-001] Tool calls blocked by gateway: {len(blocked)}")
    for item in report.human_review_checklist:
        print(f"  [{item.severity}] {item.label}")
    assert report.top_hypothesis.likelihood > 0
    assert len(report.tool_log) >= 5, "expected multiple gateway-audited tool calls"
    assert report.safety.status in {"CLEAR_TO_PROCEED", "CAUTION_REQUIRED"}, (
        f"PUMP-204 vibration scenario should not trigger DO_NOT_RESTART, got {report.safety.status}"
    )

    # Scenario 2: INC-3005 electrical anomaly with operator-reported burning smell.
    # The Safety Critic must veto restart - this is the demo's centerpiece moment.
    inc3005 = _run(
        IncidentRequest(
            incident_id="INC-3005",
            asset_id="MTR-512",
            description=(
                "Phase current imbalance climbed from 4 % to 8.7 % over the week; "
                "winding temperature now exceeds nameplate. Operator reported a faint "
                "burning smell during the swing shift. Batch B-215 quarantined for "
                "electrical safety review."
            ),
        )
    )
    print(f"\n[INC-3005] Verdict: {inc3005.safety.status}")
    print(f"[INC-3005] Blocking concerns: {inc3005.safety.blocking_concerns}")
    print(f"[INC-3005] CAPA draft suppressed: {inc3005.capa_draft is None}")

    assert inc3005.safety.status == "DO_NOT_RESTART", (
        f"INC-3005 must produce DO_NOT_RESTART (electrical + burning smell), "
        f"got {inc3005.safety.status}"
    )
    assert inc3005.safety.blocking_concerns, "DO_NOT_RESTART must have blocking concerns"
    assert inc3005.capa_draft is None, (
        "CAPA must NOT be drafted when verdict is DO_NOT_RESTART"
    )

    print("\nSMOKE TEST OK")


if __name__ == "__main__":
    main()
