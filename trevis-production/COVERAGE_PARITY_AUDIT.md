# COVERAGE PARITY AUDIT

**Date:** 2026-06-16 · **Read-only.**
**Goal:** Compare stored coverage values against the authoritative JS replay, produce exact drift counts, identify affected students, quantify portfolio impact.

---

## ✅✅ REPAIRED — 2026-06-16 20:02 UTC (R2 `--apply` executed against production)

The drift measured below has been corrected. Sequence:
1. **Backup taken** — `students_coverage_backup_20260616` (170 rows, coverage_end 2026-05-30→2026-08-26) before any write.
2. **R2 `--apply`** — `Checked: 134 | Drifted: 123 | Written: 123 | Failed: 0 | ⚠️ EARLIER: 0`.
   - 27 students: real FLOOR→ROUND extension (coverage_end moved **+1/+2 days later**) — the baseline below.
   - 96 students: stale `next_due_date`/`coverage_start` catch-up only; `coverage_end` **unchanged** (no day gained or lost).
   - **0 students** had coverage_end moved earlier — safety invariant held across the whole portfolio.
3. **Re-audit (dry-run)** — `Checked: 134 | Drifted: 0 | ✅ No drift`. Re-running `--apply` writes nothing (idempotent).

**Post-repair state: `students_with_drift = 0`, `max_days_lost = 0`.** Stored coverage now equals the authoritative JS engine for every ACTIVE student. The figures below are the pre-repair baseline, retained for the record.

---

## ✅ MEASURED FROM PRODUCTION — 2026-06-16 (SQL-editor read-only queries)

Drift was measured directly against the live database via two read-only SQL queries
(per-student day-count comparison + portfolio summary). Results below are real, not predicted.

**Headline: 27 of 134 ACTIVE students drift. Max 3 days. Avg 2.07 days. 100% undercounted (never over).
Pattern is exclusively the FLOOR rounding bug — no most-recent-only history loss survived (the JS
rebuild has been overwriting that on payment entry).**

> Note on the `57/122 ❌ FAIL` from `PHASE1_VALIDATION_AUDIT.sql`: that counts *per-payment* rows
> (65 of 122 full-payments wrong). Those 65 bad payment-rows belong to the 27 multi-payment students
> (each payment loses ~1 day). The per-student figure (**27**) is the operationally meaningful one.

---

## Methodology (what R2 dry-run does)

For each ACTIVE student: read full payment ledger (ASC) → replay through `processPayment` (the authoritative engine) → compare engine result vs stored columns → flag `DRIFT` if any of coverage_start/end/daily_rate/next_due_date differ.

## Portfolio drift report — MEASURED 2026-06-16

| Metric | Value |
|---|---|
| ACTIVE students scanned | **134** |
| Students with drift | **27** |
| FLOOR drift students (non-even daily rate, e.g. $110→3.67, $260→8.67) | **27 (100% of drift)** |
| Historical replay drift students (most-recent-only victims) | **0** (already corrected by JS rebuild on payment entry) |
| Max days incorrect | **3** |
| Average days incorrect (among drifters) | **2.07** |
| Direction of error | **100% undercount** (stored ≤ correct, always) |
| Total overdue students BEFORE | 3 |
| Total overdue students AFTER replay | **3** (no drifter is overdue — none flips) |
| Total expiring (EXPIRING_SOON) BEFORE | 10 |
| Total expiring AFTER replay | **~4** (≈6 boundary students at 6d→8d flip to CURRENT) |

> SQL-editor estimate uses continuous-coverage summation; exact corrected `coverage_end` per student
> comes from the R2 `--apply` replay through `processPayment`. Drift *set* and *direction* are exact.

### Operationally significant: ~6 boundary students wrongly shown EXPIRING_SOON
These sit at stored 6 days remaining (EXPIRING_SOON) but are owed +2 days → real 8 days (CURRENT).
They may receive unnecessary "rent almost due" nudges until corrected:

| Student | Stored days remaining | Owed | Real |
|---|---|---|---|
| Thandeka Gumbo | 6 | +2 | 8 (CURRENT) |
| Maitaishe Manatsa | 6 | +2 | 8 (CURRENT) |
| Bethel Mudavanhu | 6 | +2 | 8 (CURRENT) |
| Tinotenda Mambo | 6 | +2 | 8 (CURRENT) |
| Prisilla Poashayi | 6 | +2 | 8 (CURRENT) |
| Chengeto Kanyai | 6 | +2 | 8 (CURRENT) |

**No student is wrongly OVERDUE.** The 3 overdue students do not appear in the drift set.

### Full drift list (27 students, measured)

| Student | Rent | Payments | Days lost | Stored coverage_end |
|---|---|---|---|---|
| Priscilla Maposa | 110 | 3 | 3 | 2026-07-21 |
| Nerrisa Zindowe | 110 | 3 | 3 | 2026-07-02 |
| Ashley Hosvori | 110 | 3 | 3 | 2026-07-21 |
| Mr Matenhese | 260 | 3 | 3 | 2026-07-21 |
| Onenhlanha Nyathi | 110 | 5 | 3 | 2026-07-22 |
| Tashley Kandoto | 110 | 3 | 3 | 2026-07-21 |
| Thandiwe Sibanda | 110 | 3 | 3 | 2026-07-21 |
| Tanya Gweru | 110 | 3 | 3 | 2026-07-21 |
| Alaine Zindere | 110 | 2 | 2 | 2026-06-25 |
| Thandeka Gumbo | 110 | 2 | 2 | 2026-06-22 |
| Thandisile Ndebele | 110 | 2 | 2 | 2026-06-26 |
| Lyne Mudakwenda | 110 | 2 | 2 | 2026-06-27 |
| Dephen Chakandinakira | 110 | 2 | 2 | 2026-06-27 |
| Maitaishe Manatsa | 110 | 2 | 2 | 2026-06-22 |
| Bethel Mudavanhu | 110 | 2 | 2 | 2026-06-22 |
| Ruvarashe Musungo | 110 | 2 | 2 | 2026-07-13 |
| Tinotenda Mambo | 110 | 2 | 2 | 2026-06-22 |
| Prisilla Poashayi | 110 | 2 | 2 | 2026-06-22 |
| Chengeto Kanyai | 110 | 2 | 2 | 2026-06-22 |
| Tariro Mufusire | 110 | 2 | 2 | 2026-07-21 |
| Abel Magari | 260 | 2 | 2 | 2026-07-04 |
| Courage Ncube | 100 | 3 | 1 | 2026-07-09 |
| Dennise Kombora | 150 | 2 | 1 | 2026-07-13 |
| TAPIWA KAUTA | 130 | 2 | 1 | 2026-07-08 |
| Taedza Chimurendo | 110 | 3 | 1 | 2026-08-26 |
| TAONGA SHUMBA | 130 | 2 | 1 | 2026-07-06 |
| Ella Moyo | 130 | 3 | 1 | 2026-07-10 |

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

## Side-finding: the divergent SQL view is live in production
The two diagnostic scripts returned **different status counts on the same DB at the same moment**:
- stored-column basis (`phase4b3` STEP 6): 121 current / 10 expiring / 3 overdue
- `student_coverage_status` **view** (`VERIFY_SPRINT5.5`): 103 current / 28 expiring / 3 overdue

This confirms the second engine (`calculate_coverage` + the FLOOR view, inventory #8) **exists and is
queryable in production**. The live app does not read it (only dead `_archive/` code does), so users
don't see it — but it is a standing trap. Drop it per `SQL_RETIREMENT_MATRIX.md` (low urgency, unused).

## Bottom line
- The **engine** is verified correct (MONTH_BOUNDARY_VERIFICATION 17/17; Rutendo reconstruction).
- **Stored data parity: MEASURED. 27/134 drift (20%), all FLOOR undercount, 1–3 days.** No money owed
  to the business; ~6 students currently shown EXPIRING_SOON who have actually paid through.
- Direction of all error is "undercount," so the repair only restores paid-for days — safe for tenants.
- **No student is wrongly OVERDUE.** Severity: 🟡 trust/accuracy, not 🔴 financial. The repair (R2
  `--apply` after backup) corrects all 27 in one pass and is non-destructive.
