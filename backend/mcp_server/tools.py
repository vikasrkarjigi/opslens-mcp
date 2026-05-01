"""Pure-python implementations of the 6 MCP tools.

These functions are imported both by the MCP server (for stdio transport)
and by the in-process fallback used inside the FastAPI app, so the system
runs whether or not the MCP server is reachable.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


# --- lazy loaders -----------------------------------------------------------
_cache: dict[str, Any] = {}


def _load_json(name: str) -> Any:
    if name not in _cache:
        _cache[name] = json.loads((DATA_DIR / name).read_text())
    return _cache[name]


def _load_sensors() -> pd.DataFrame:
    if "sensors" not in _cache:
        df = pd.read_csv(DATA_DIR / "sensor_logs.csv")
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
        _cache["sensors"] = df
    return _cache["sensors"]


def _ensure_data() -> None:
    if not (DATA_DIR / "sensor_logs.csv").exists():
        # Trigger generation
        import importlib

        importlib.import_module("data.synthetic_dataset")


_ensure_data()


# --- tool implementations ---------------------------------------------------
def query_sensor_data(asset_id: str, hours: int = 72, metrics: list[str] | None = None) -> dict[str, Any]:
    """Return summary statistics + recent samples for the given asset."""
    df = _load_sensors()
    sub = df[df["asset_id"] == asset_id].copy()
    if sub.empty:
        return {"error": f"unknown asset_id {asset_id}", "asset_id": asset_id}

    cutoff = sub["timestamp"].max() - pd.Timedelta(hours=hours)
    window = sub[sub["timestamp"] >= cutoff]

    numeric = ["temperature_c", "vibration_mm_s", "current_a", "pressure_bar", "flow_m3h"]
    if metrics:
        numeric = [m for m in numeric if m in metrics]

    stats = {}
    for col in numeric:
        baseline = sub[col].iloc[: max(1, len(sub) - 72)]
        recent = window[col]
        stats[col] = {
            "baseline_mean": round(float(baseline.mean()), 3),
            "baseline_std": round(float(baseline.std()), 3),
            "recent_mean": round(float(recent.mean()), 3),
            "recent_max": round(float(recent.max()), 3),
            "delta_pct": round(float((recent.mean() - baseline.mean()) / max(abs(baseline.mean()), 1e-6) * 100), 2),
        }

    samples = window.tail(12)[["timestamp"] + numeric].to_dict(orient="records")
    for s in samples:
        s["timestamp"] = s["timestamp"].isoformat()

    return {
        "asset_id": asset_id,
        "window_hours": hours,
        "stats": stats,
        "recent_samples": samples,
    }


def get_maintenance_history(asset_id: str) -> dict[str, Any]:
    history = _load_json("maintenance_history.json").get(asset_id, [])
    quality = [q for q in _load_json("quality_records.json") if q.get("asset_id") == asset_id]
    return {
        "asset_id": asset_id,
        "entries": history,
        "count": len(history),
        "quality_records": quality,
    }


def search_incident_database(query: str, asset_class: str | None = None, limit: int = 5) -> dict[str, Any]:
    incidents = _load_json("incidents.json")
    q = query.lower()
    scored = []
    for inc in incidents:
        if asset_class and inc["asset_class"] != asset_class:
            continue
        haystack = " ".join([inc["root_cause"]] + inc["symptoms"]).lower()
        score = sum(1 for term in q.split() if term in haystack)
        if score:
            scored.append((score, inc))
    scored.sort(key=lambda x: -x[0])
    return {"matches": [i for _, i in scored[:limit]], "query": query}


def fetch_equipment_specs(asset_id: str) -> dict[str, Any]:
    assets = _load_json("assets.json")
    for a in assets:
        if a["asset_id"] == asset_id:
            return a
    return {"error": f"unknown asset_id {asset_id}"}


def run_diagnostic_check(asset_id: str) -> dict[str, Any]:
    """Apply rule-based diagnostics over the latest sensor window vs. specs."""
    specs = fetch_equipment_specs(asset_id)
    if "error" in specs:
        return specs
    snap = query_sensor_data(asset_id, hours=24)
    findings: list[dict[str, Any]] = []

    s = snap.get("stats", {})
    sp = specs.get("specs", {})

    def _flag(metric: str, recent: float, limit: float, kind: str) -> None:
        if recent is None or limit is None:
            return
        ratio = recent / limit
        if ratio >= 0.9:
            findings.append(
                {
                    "metric": metric,
                    "recent": recent,
                    "limit": limit,
                    "ratio": round(ratio, 3),
                    "severity": "critical" if ratio >= 1.0 else "warning",
                    "kind": kind,
                }
            )

    if "temperature_c" in s and "max_temp_c" in sp:
        _flag("temperature_c", s["temperature_c"]["recent_max"], sp["max_temp_c"], "thermal")
    if "vibration_mm_s" in s and "max_vibration_mm_s" in sp:
        _flag("vibration_mm_s", s["vibration_mm_s"]["recent_max"], sp["max_vibration_mm_s"], "mechanical")
    if "current_a" in s and "rated_current_a" in sp:
        _flag("current_a", s["current_a"]["recent_max"], sp["rated_current_a"] * 1.1, "electrical")

    return {
        "asset_id": asset_id,
        "asset_class": specs.get("class"),
        "findings": findings,
        "stats_snapshot": s,
        "ran_at": datetime.now(timezone.utc).isoformat(),
    }


def search_sop(query: str, limit: int = 3) -> dict[str, Any]:
    """Keyword search across the SOP markdown document.

    Returns whole-SOP sections that score on the query terms. Used by the
    Safety Critic to cite the exact procedure that applies.
    """
    sop_path = DATA_DIR / "sop_documents.md"
    if not sop_path.exists():
        return {"error": "sop_documents.md not found"}
    text = sop_path.read_text(encoding="utf-8")

    sections: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for line in text.splitlines():
        if line.startswith("## SOP-"):
            if current:
                sections.append(current)
            # Heading format: `## SOP-XXX-NN: Title` or `## SOP-XXX-NN Title`.
            # The SOP id is always the first whitespace-delimited token, so we
            # split on the first space and strip a trailing colon if present.
            header = line[3:].strip()
            sop_id = header.split()[0].rstrip(":")
            current = {"id": sop_id, "heading": header, "body": ""}
        elif current is not None:
            current["body"] += line + "\n"
    if current:
        sections.append(current)

    q_terms = [t for t in query.lower().split() if len(t) > 2]
    scored: list[tuple[int, dict[str, Any]]] = []
    for s in sections:
        haystack = (s["heading"] + " " + s["body"]).lower()
        score = sum(haystack.count(term) for term in q_terms)
        if score:
            scored.append((score, s))
    scored.sort(key=lambda x: -x[0])

    matches = []
    for score, s in scored[:limit]:
        # Trim body to ~600 chars for the LLM context
        body = s["body"].strip()
        if len(body) > 600:
            body = body[:600] + "…"
        matches.append({"sop_id": s["id"], "heading": s["heading"], "excerpt": body, "score": score})
    return {"query": query, "matches": matches, "total_sops": len(sections)}


def generate_capa_draft(
    incident_id: str,
    root_cause: str,
    corrective_actions: list[str] | None = None,
    preventive_actions: list[str] | None = None,
) -> dict[str, Any]:
    """Generate a Corrective & Preventive Action draft.

    This is a *draft*; it must be reviewed and signed by a human engineer
    before being submitted to the CMMS / quality system.
    """
    corrective = corrective_actions or [
        "Take asset out of service and apply LOTO per SOP-SAFE-01.",
        "Replace the suspected component (see hypothesis) with OEM-spec parts.",
        "Re-run post-maintenance verification per SOP-MAINT-04.",
    ]
    preventive = preventive_actions or [
        "Add the failure-mode signature to the predictive-maintenance ruleset.",
        "Tighten the inspection interval for similar assets in the fleet.",
        "Update operator round-sheets to capture the early warning signal.",
    ]
    return {
        "incident_id": incident_id,
        "draft_status": "DRAFT: requires engineer sign-off",
        "root_cause": root_cause,
        "corrective_actions": corrective,
        "preventive_actions": preventive,
        "approvals_required": ["Maintenance Lead", "Quality Lead", "Site Safety Officer"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def get_safety_protocols(asset_id: str | None = None, asset_class: str | None = None) -> dict[str, Any]:
    protocols = _load_json("safety_protocols.json")
    cls = asset_class
    if asset_id and not cls:
        spec = fetch_equipment_specs(asset_id)
        cls = spec.get("class") if isinstance(spec, dict) else None
    if not cls:
        return {"error": "must provide asset_id or asset_class"}
    return {"asset_class": cls, "protocols": protocols.get(cls, [])}


# --- registry ---------------------------------------------------------------
# `risk`: operational risk if this tool is mis-used or its result is acted on
#         without review. `access`: whether the tool can change anything.
# These badges are surfaced in the MCP Gateway UI so the operator can verify
# at a glance that nothing here writes back to plant systems.
TOOLS: dict[str, dict[str, Any]] = {
    "query_sensor_data": {
        "fn": query_sensor_data,
        "description": "Return baseline vs. recent statistics and recent samples for an asset's sensors.",
        "risk": "low",
        "access": "read",
        "schema": {
            "type": "object",
            "properties": {
                "asset_id": {"type": "string"},
                "hours": {"type": "integer", "default": 72},
                "metrics": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["asset_id"],
        },
    },
    "get_maintenance_history": {
        "fn": get_maintenance_history,
        "description": "Recent work-orders, inspections and quality records for an asset.",
        "risk": "low",
        "access": "read",
        "schema": {
            "type": "object",
            "properties": {"asset_id": {"type": "string"}},
            "required": ["asset_id"],
        },
    },
    "search_incident_database": {
        "fn": search_incident_database,
        "description": "Search historical RCA reports across the fleet by symptom keywords.",
        "risk": "low",
        "access": "read",
        "schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "asset_class": {"type": "string"},
                "limit": {"type": "integer", "default": 5},
            },
            "required": ["query"],
        },
    },
    "fetch_equipment_specs": {
        "fn": fetch_equipment_specs,
        "description": "Nameplate, manufacturer and design-limit data for an asset.",
        "risk": "low",
        "access": "read",
        "schema": {
            "type": "object",
            "properties": {"asset_id": {"type": "string"}},
            "required": ["asset_id"],
        },
    },
    "run_diagnostic_check": {
        "fn": run_diagnostic_check,
        "description": "Rule-based diagnostic comparing live readings against design limits.",
        "risk": "medium",
        "access": "read",
        "schema": {
            "type": "object",
            "properties": {"asset_id": {"type": "string"}},
            "required": ["asset_id"],
        },
    },
    "get_safety_protocols": {
        "fn": get_safety_protocols,
        "description": "Mandatory safety protocols and LOTO procedures by asset class.",
        "risk": "low",
        "access": "read",
        "schema": {
            "type": "object",
            "properties": {
                "asset_id": {"type": "string"},
                "asset_class": {"type": "string"},
            },
        },
    },
    "search_sop": {
        "fn": search_sop,
        "description": "Keyword search across the SOP corpus (post-maintenance, electrical, quality, LOTO).",
        "risk": "low",
        "access": "read",
        "schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "limit": {"type": "integer", "default": 3},
            },
            "required": ["query"],
        },
    },
    "generate_capa_draft": {
        "fn": generate_capa_draft,
        "description": "Draft a Corrective & Preventive Action document for human sign-off. Output is a DRAFT only.",
        "risk": "high",
        "access": "draft-only",
        "schema": {
            "type": "object",
            "properties": {
                "incident_id": {"type": "string"},
                "root_cause": {"type": "string"},
                "corrective_actions": {"type": "array", "items": {"type": "string"}},
                "preventive_actions": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["incident_id", "root_cause"],
        },
    },
}


def tool_metadata(name: str) -> dict[str, str]:
    meta = TOOLS.get(name, {})
    return {"risk": meta.get("risk", "unknown"), "access": meta.get("access", "unknown")}


def call_tool(name: str, arguments: dict[str, Any] | None = None) -> Any:
    arguments = arguments or {}
    if name not in TOOLS:
        return {"error": f"unknown tool {name}"}
    try:
        return TOOLS[name]["fn"](**arguments)
    except TypeError as e:
        return {"error": f"bad arguments for {name}: {e}"}
    except Exception as e:  # pragma: no cover - defensive
        return {"error": f"{type(e).__name__}: {e}"}
