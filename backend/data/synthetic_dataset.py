"""Generate a small synthetic industrial dataset for OpsLens MCP demos.

Run once (or it auto-runs on import) to populate `backend/data/`:
- assets.json            : equipment registry with specs
- sensor_logs.csv        : 30 days of hourly sensor readings for each asset
- maintenance_history.json
- incidents.json         : historical incidents with root causes
- safety_protocols.json  : per-asset-class safety procedures
"""
from __future__ import annotations

import json
import math
import random
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent
DATA_DIR.mkdir(parents=True, exist_ok=True)

RNG = np.random.default_rng(42)
random.seed(42)

ASSETS = [
    {
        "asset_id": "PUMP-204",
        "class": "centrifugal_pump",
        "site": "PLANT-1",
        "manufacturer": "Grundfos",
        "model": "NK-150",
        "installed": "2019-03-12",
        "specs": {
            "rated_flow_m3h": 220,
            "rated_head_m": 55,
            "rated_power_kw": 45,
            "max_temp_c": 85,
            "max_vibration_mm_s": 7.1,
            "bearing_type": "6312-C3",
        },
        "fault_profile": "bearing_wear",
    },
    {
        "asset_id": "COMP-118",
        "class": "screw_compressor",
        "site": "PLANT-1",
        "manufacturer": "Atlas Copco",
        "model": "GA-90",
        "installed": "2017-08-01",
        "specs": {
            "rated_pressure_bar": 8.5,
            "rated_power_kw": 90,
            "max_temp_c": 105,
            "oil_type": "Roto-Inject Fluid",
        },
        "fault_profile": "oil_contamination",
    },
    {
        "asset_id": "HX-307",
        "class": "shell_tube_heat_exchanger",
        "site": "PLANT-2",
        "manufacturer": "Alfa Laval",
        "model": "M15-BFG",
        "installed": "2020-11-20",
        "specs": {
            "design_pressure_bar": 16,
            "max_temp_c": 180,
            "tube_material": "SS-316L",
        },
        "fault_profile": "fouling",
    },
    {
        "asset_id": "MTR-512",
        "class": "induction_motor",
        "site": "PLANT-2",
        "manufacturer": "ABB",
        "model": "M3BP-280",
        "installed": "2018-05-30",
        "specs": {
            "rated_power_kw": 75,
            "rated_voltage_v": 400,
            "rated_current_a": 135,
            "max_temp_c": 95,
        },
        "fault_profile": "winding_imbalance",
    },
]


def _sensor_series(asset: dict, hours: int = 24 * 30) -> pd.DataFrame:
    """Generate plausible sensor traces with a fault appearing in the last ~72h."""
    end = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    timestamps = [end - timedelta(hours=hours - i) for i in range(hours)]
    t = np.arange(hours)
    fault_start = hours - 72  # fault grows over last 3 days

    profile = asset["fault_profile"]
    base_temp = 55 + 5 * np.sin(t / 24 * 2 * math.pi) + RNG.normal(0, 0.6, hours)
    base_vib = 2.1 + 0.2 * np.sin(t / 12 * 2 * math.pi) + RNG.normal(0, 0.08, hours)
    base_current = 110 + 4 * np.sin(t / 24 * 2 * math.pi) + RNG.normal(0, 1.0, hours)
    base_pressure = 6.8 + 0.3 * np.sin(t / 8 * 2 * math.pi) + RNG.normal(0, 0.05, hours)
    base_flow = 210 + 6 * np.sin(t / 24 * 2 * math.pi) + RNG.normal(0, 1.5, hours)

    fault_ramp = np.clip((t - fault_start) / 72.0, 0, 1)

    if profile == "bearing_wear":
        base_vib += fault_ramp * 5.2  # vibration ramps toward 7+ mm/s
        base_temp += fault_ramp * 12
    elif profile == "oil_contamination":
        base_temp += fault_ramp * 18
        base_current += fault_ramp * 14
    elif profile == "fouling":
        base_temp += fault_ramp * 22
        base_pressure -= fault_ramp * 1.4
        base_flow -= fault_ramp * 35
    elif profile == "winding_imbalance":
        base_current += fault_ramp * 22
        base_temp += fault_ramp * 16

    df = pd.DataFrame(
        {
            "timestamp": [ts.isoformat() + "Z" for ts in timestamps],
            "asset_id": asset["asset_id"],
            "temperature_c": base_temp.round(2),
            "vibration_mm_s": base_vib.round(3),
            "current_a": base_current.round(2),
            "pressure_bar": base_pressure.round(3),
            "flow_m3h": base_flow.round(2),
        }
    )
    return df


MAINTENANCE_TEMPLATES = {
    "PUMP-204": [
        ("2024-09-04", "Scheduled bearing inspection", "ok"),
        ("2025-01-18", "Replaced mechanical seal", "ok"),
        ("2025-08-22", "Vibration trend flagged - lubrication top-up", "open"),
    ],
    "COMP-118": [
        ("2024-11-12", "Oil change + filter replacement", "ok"),
        ("2025-06-30", "Air-end inspection", "ok"),
    ],
    "HX-307": [
        ("2024-12-01", "Chemical clean cycle", "ok"),
        ("2025-07-15", "Tube bundle inspection - mild fouling noted", "monitor"),
    ],
    "MTR-512": [
        ("2025-02-09", "Insulation resistance test - within tolerance", "ok"),
        ("2025-09-01", "Phase current imbalance reported by operator", "open"),
    ],
}


HISTORICAL_INCIDENTS = [
    {
        "incident_id": "INC-2024-0411",
        "asset_class": "centrifugal_pump",
        "symptoms": ["rising vibration", "elevated bearing temperature"],
        "root_cause": "Outer race spalling on drive-end bearing due to delayed re-lubrication.",
        "corrective_action": "Replaced bearing, updated lubrication interval from 3000h to 2000h.",
    },
    {
        "incident_id": "INC-2024-0902",
        "asset_class": "screw_compressor",
        "symptoms": ["high discharge temperature", "increased motor current"],
        "root_cause": "Oil degraded past service life leading to reduced cooling efficiency.",
        "corrective_action": "Oil change + cooler clean. Added oil-quality sensor.",
    },
    {
        "incident_id": "INC-2025-0117",
        "asset_class": "shell_tube_heat_exchanger",
        "symptoms": ["reduced flow", "rising outlet temperature", "pressure drop increase"],
        "root_cause": "Tube-side fouling from feedwater hardness excursion.",
        "corrective_action": "CIP cycle, installed inline hardness monitor.",
    },
    {
        "incident_id": "INC-2025-0322",
        "asset_class": "induction_motor",
        "symptoms": ["phase current imbalance", "winding temperature rise"],
        "root_cause": "Inter-turn short on phase B winding from moisture ingress.",
        "corrective_action": "Rewound stator, added space heater interlock.",
    },
]


QUALITY_RECORDS = [
    {
        "asset_id": "PUMP-204",
        "lot_id": "L-2025-0918",
        "date": "2025-09-18",
        "metric": "discharge_pressure_stability_pct",
        "value": 91.2,
        "spec_low": 95.0,
        "result": "OOS",
        "note": "Pressure pulsations correlate with vibration excursions on drive end.",
    },
    {
        "asset_id": "COMP-118",
        "lot_id": "L-2025-0902",
        "date": "2025-09-02",
        "metric": "dewpoint_c",
        "value": -38.0,
        "spec_low": -40.0,
        "result": "OOS",
        "note": "Slight degradation - aligns with rising air-end temperatures.",
    },
    {
        "asset_id": "HX-307",
        "lot_id": "L-2025-0825",
        "date": "2025-08-25",
        "metric": "outlet_temperature_c",
        "value": 96.4,
        "spec_high": 90.0,
        "result": "OOS",
        "note": "Likely fouling driver - matches flow drop on the same day.",
    },
    {
        "asset_id": "MTR-512",
        "lot_id": "L-2025-0910",
        "date": "2025-09-10",
        "metric": "phase_current_imbalance_pct",
        "value": 8.7,
        "spec_high": 5.0,
        "result": "OOS",
        "note": "Imbalance trending up week-over-week.",
    },
]


SAFETY_PROTOCOLS = {
    "centrifugal_pump": [
        "Lock-Out / Tag-Out (LOTO) electrical disconnect before any internal inspection.",
        "Verify pump is isolated and depressurised; bleed casing through vent valve.",
        "Allow casing temperature < 40 C before disassembly.",
        "Check alignment and coupling guard reinstalled before restart.",
    ],
    "screw_compressor": [
        "Bleed receiver to 0 bar and verify with calibrated gauge.",
        "Lock out main breaker and dryer feed.",
        "Use approved oil only; verify viscosity grade against nameplate.",
        "Hot-surface PPE required - oil sump can exceed 90 C for 30+ minutes after stop.",
    ],
    "shell_tube_heat_exchanger": [
        "Drain and flush both shell and tube sides before opening end caps.",
        "Confirm no residual chemical (pH 6-8) before manned entry near tube sheet.",
        "Torque end-cap bolts in the documented star pattern at restart.",
    ],
    "induction_motor": [
        "LOTO upstream breaker AND verify zero potential at terminal box.",
        "Discharge any capacitor banks; wait 5 minutes minimum.",
        "Megger test required after any winding work.",
    ],
}


def regenerate(force: bool = False) -> None:
    assets_path = DATA_DIR / "assets.json"
    sensors_path = DATA_DIR / "sensor_logs.csv"
    maint_path = DATA_DIR / "maintenance_history.json"
    incidents_path = DATA_DIR / "incidents.json"
    safety_path = DATA_DIR / "safety_protocols.json"
    quality_path = DATA_DIR / "quality_records.json"

    if not force and all(
        p.exists() for p in [assets_path, sensors_path, maint_path, incidents_path, safety_path, quality_path]
    ):
        return

    assets_path.write_text(json.dumps(ASSETS, indent=2))

    frames = [_sensor_series(a) for a in ASSETS]
    pd.concat(frames, ignore_index=True).to_csv(sensors_path, index=False)

    maint = {
        aid: [{"date": d, "action": a, "status": s} for d, a, s in rows]
        for aid, rows in MAINTENANCE_TEMPLATES.items()
    }
    maint_path.write_text(json.dumps(maint, indent=2))

    incidents_path.write_text(json.dumps(HISTORICAL_INCIDENTS, indent=2))
    safety_path.write_text(json.dumps(SAFETY_PROTOCOLS, indent=2))
    quality_path.write_text(json.dumps(QUALITY_RECORDS, indent=2))


regenerate()


if __name__ == "__main__":
    regenerate(force=True)
    print(f"Synthetic dataset written to {DATA_DIR}")
