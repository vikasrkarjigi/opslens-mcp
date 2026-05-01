# OpsLens Standard Operating Procedures

> Searched at runtime by the `search_sop` MCP tool. Each SOP is delimited by an
> `## SOP-…` heading so the search tool can return whole-document hits.

---

## SOP-MAINT-04: Post-Maintenance Verification

**Applies to:** rotating equipment after bearing, seal, or coupling work.

**Steps:**
1. Verify mechanical alignment within 0.05 mm parallel and 0.10 mm/100 mm angular.
2. Run uncoupled spin test for 60 seconds; record vibration baseline at drive end and non-drive end.
3. Couple, run at 25 % / 50 % / 100 % rated speed for 5 minutes each; vibration must stay below ISO 10816 zone B.
4. Document all readings on Form QA-MAINT-04A. **An undocumented alignment check is treated as no alignment check.**
5. Engineer sign-off mandatory before returning asset to service.

**Failure modes if skipped:** premature bearing spalling, seal leakage, coupling fatigue.

---

## SOP-ELEC-02: Electrical Anomaly Response

**Applies to:** any phase imbalance, overcurrent, or insulation-resistance excursion.

**Steps:**
1. **DO NOT RESTART** the asset until a licensed electrician has cleared it in writing.
2. LOTO upstream breaker; verify zero potential at the terminal box with a calibrated meter.
3. Discharge any capacitor banks; wait minimum 5 minutes.
4. Megger test phase-to-phase and phase-to-earth at 500 V DC; record on Form ELEC-02B.
5. If any reading is below 1 MΩ, escalate to capital review. Do not patch in service.

**Trigger thresholds:** phase current imbalance > 5 %, sustained overcurrent > 10 %, winding temperature > nameplate × 1.05.

---

## SOP-QUAL-07: Dimensional / Process Drift Response

**Applies to:** any in-process metric drifting outside spec for ≥ 2 consecutive batches or ≥ 24 h.

**Steps:**
1. Place the affected batch(es) **ON HOLD** in the MES.
2. Notify the customer-quality liaison within 4 hours if external lots are impacted.
3. Quarantine downstream inventory pending root-cause closure.
4. Trend the controlling sensor against baseline; identify the inflection timestamp.
5. Do not release until RCA is signed off by Quality + Maintenance leads.

---

## SOP-SAFE-01: Lockout / Tagout

**Applies to:** every internal inspection, disassembly, or electrical work.

**Steps:**
1. Notify operators on shift; agree on isolation boundary.
2. Shut down asset following the documented stop sequence.
3. Isolate every energy source: electrical, pneumatic, hydraulic, thermal, stored mechanical.
4. Apply **personal** locks: one per worker. No shared locks.
5. Tag each lock with worker name, date, and reason.
6. Verify zero energy at the work point with a calibrated test before contact.
7. Perform the work.
8. Remove locks only by the worker who applied them, in reverse order; log restoration.
