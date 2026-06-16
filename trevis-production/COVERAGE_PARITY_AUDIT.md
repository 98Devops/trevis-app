# COVERAGE PARITY AUDIT

**Date:** 2026-06-16 · **Read-only.**
**Goal:** Compare stored coverage values against the authoritative JS replay, produce exact drift counts, identify affected students, quantify portfolio impact.

---

## ⚠️ Status of the numbers: NOT YET MEASURABLE FROM THIS ENVIRONMENT

The exact drift counts require running R2 against the live database:

```bash
SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node scripts/replay_portfolio_coverage.mjs --dry-run
```

This audit environment has **no production DB credentials**, so I will **not fabricate counts**. Below is (1) the exact methodology, (2) the metrics table to fill from the dry-run, and (3) statically-provable predictions of *which cohorts* will drift and *by how much per payment* — derived from the math divergences proven in `COVERAGE_WRITER_INVENTORY.md`. Whether the answer is "3 students or 40 students" is exactly what the dry-run resolves — and it must be run before Phase 4C.

---

## Methodology (what R2 dry-run does)

For each ACTIVE student: read full payment ledger (ASC) → replay through `processPayment` (the authoritative engine) → compare engine result vs stored columns → flag `DRIFT` if any of coverage_start/end/daily_rate/next_due_date differ.

## Portfolio drift report — FILL FROM DRY-RUN

| Metric | Value |
|---|---|
| ACTIVE students scanned | _____ |
| Students with drift | _____ |
| FLOOR drift students (non-even daily rate, e.g. $110→3.67, $260→8.67) | _____ |
| Historical replay drift students (multi-payment / prepaid carry, most-recent-only victims) | _____ |
| Max days incorrect | _____ |
| Average days incorrect | _____ |
| Total overdue students BEFORE replay | _____ |
| Total overdue students AFTER replay | _____ |
| Total expiring students BEFORE replay | _____ |
| Total expiring students AFTER replay | _____ |

> Capture the dry-run console `DRIFT …` lines into an appendix here as the affected-student list.

---

## Statically-provable predictions (the math, before the count)

These hold regardless of how many students are affected — they define *who* will appear in the drift list:

### Prediction 1 — FLOOR cohort loses ≥1 day/payment
Any student whose `daily_rate` does not evenly divide their payment amount was short-changed by every SQL writer using `FLOOR` (`rebuild_student_coverage_from_payments`, `calculate_coverage`).
- $110 rent → daily 3.67 → `110/3.67 = 29.97` → FLOOR **29** vs ROUND **30** → **−1 day/payment**.
- $260 rent → daily 8.67 → `260/8.67 = 29.99` → FLOOR **29** vs ROUND **30** → **−1 day/payment**.
- Error **compounds** per payment in the full-replay SQL function (n payments → up to −n days).

### Prediction 2 — most-recent-only cohort loses all prepaid history
Any student whose stored columns were last written by `populate_rent_cycle_fields` (most-recent payment only) lost prepaid carry-over from earlier payments.
- **Rutendo Hlabati** (3 payments, $360 total): most-recent-only → ~28 days from last payment; correct full replay → coverage_end **2026-07-23**, CURRENT/37d. Drift ≈ **+9 days** undercounted historically. (See `DATA_TRUTH_AUDIT.md`.)

### Prediction 3 — drift direction is always "stored ≤ correct"
Both bad algorithms *undercount* coverage (FLOOR rounds down; most-recent drops history). Therefore replay can only **extend** coverage or leave it equal — never shorten it. **Consequence:** post-replay, `overdue` and `expiring` counts can only **stay the same or decrease**. No student becomes *more* overdue. This makes the `--apply` strictly safe for tenant relations (we never wrongly extend; we restore days they paid for).

### Prediction 4 — students last written by JS already match
Any student whose most recent mutation went through the app (`recordPaymentWithCoverage`/`updatePayment`/`deletePayment` → `rebuildStudentCoverage`) is already correct and will show **no drift**. The drift set ≈ students untouched since the last SQL backfill.

---

## Affected-students table — FILL FROM DRY-RUN

| Student | Stored coverage_end | Correct coverage_end | Δ days | Cohort (FLOOR / history) | Status before → after |
|---|---|---|---|---|---|
| Rutendo Hlabati | (e.g. ~2026-07-14) | 2026-07-23 | +9 | history | OVERDUE? → CURRENT |
| … | | | | | |

---

## Bottom line
- The **engine** is verified correct (MONTH_BOUNDARY_VERIFICATION 17/17; Rutendo reconstruction).
- The **stored data** parity is **unmeasured until the dry-run runs** — and that run is the gating evidence for Phase 4C readiness.
- Direction of all error is provably "undercount," so the repair is safe and only ever restores paid-for days.
