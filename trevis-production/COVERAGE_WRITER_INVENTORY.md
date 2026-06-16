# COVERAGE WRITER INVENTORY

**Date:** 2026-06-16
**Scope:** Every code path (SQL + JS) that can write `coverage_start`, `coverage_end`, `daily_rate`, `next_due_date`, or `billing_anchor_date`.
**Method:** Full repo SQL sweep (33 `.sql` files), function/trigger grep, app RPC-reference grep. **Read-only. No modifications.**
**Headline:** The R1 work retired **one** SQL writer signature. This inventory finds **the same function defined in 4 separate files** plus a **second parallel coverage engine** (`calculate_coverage` + backfill blocks) that R1 never touched. There are currently **multiple latent writers**, not one.

---

## A. The five fields and where they live

| Field | Table |
|---|---|
| coverage_start | students |
| coverage_end | students |
| daily_rate | students |
| next_due_date | students |
| billing_anchor_date | students |

(`payments.coverage_start_date / coverage_end_date / days_covered` are per-payment metadata, written by the same functions; included below where relevant.)

---

## B. Writer inventory

| # | File | Function / Block | Type | Writes coverage? | Math | Status |
|---|------|------------------|------|------------------|------|--------|
| 1 | `src/services/coverageDatabaseService.js` | `rebuildStudentCoverage()` | JS (app) | ✅ all 4 (+ per-payment) | ROUND, full replay | **✅ ACTIVE — AUTHORITATIVE** |
| 2 | `src/services/coverageRepairService.js` | `repairAllStudentsCoverage()` | JS (app) | ✅ (delegates to #1) | via #1 | ✅ ACTIVE (admin trigger) |
| 3 | `scripts/replay_portfolio_coverage.mjs` | `replayLedger()` `--apply` | JS (CLI) | ✅ all 4 | via `processPayment` (same as #1) | ✅ ACTIVE (operator, dry-run gated) |
| 4 | `supabase/sprint5.5_rent_cycle_schema.sql` | `populate_rent_cycle_fields()` | SQL func | ✅ all 4 (writes `billing_anchor_date`!) | ROUND, **most-recent-payment only** | ⚠️ R1 banner added, but see note |
| 5 | `supabase/FIX_COVERAGE_DAYS_ROUNDING.sql` | `populate_rent_cycle_fields()` | SQL func | ✅ all 4 | ROUND (explicit cast), **most-recent only** | 🔴 **NOT retired by R1** |
| 6 | `supabase/RUN_THIS_COMPLETE.sql` | `populate_rent_cycle_fields()` | SQL func | ✅ all 4 | ROUND, **most-recent only** | 🔴 **NOT retired by R1** |
| 7 | `supabase/phase4b3_repair_stale_coverage.sql` | `rebuild_student_coverage_from_payments()` | SQL func | ✅ all 4 (+ per-payment) | **FLOOR**, full replay | ⚠️ R1 banner added |
| 8 | `supabase/sprint5.5_flexible_rent_cycles_CORRECTED.sql` | `calculate_coverage()` + STEP 6/7 `DO` blocks | SQL func + anon blocks | ✅ `coverage_start/end/daily_rate` (NOT next_due/anchor) | **FLOOR**, most-recent payment for student row | 🔴 **NOT retired by R1** |
| 9 | `supabase/sprint5.5_flexible_rent_cycles.sql` | `calculate_coverage()` + STEP 6/7 `DO` blocks | SQL func + anon blocks | ✅ same as #8 | **FLOOR** | 🔴 **NOT retired by R1** (older copy of #8) |
| 10 | `supabase/R1_retire_sql_coverage_rebuild.sql` | retirement stubs | SQL | replaces #4/#7 sig w/ `RAISE EXCEPTION` | n/a | ✅ remediation (operator must run) |
| — | `src/services/_archive/coverageService.legacy.js` | reads `get_dashboard_kpis` / `student_coverage_status` | JS (dead) | ❌ read-only, unimported | n/a | ☠️ dead (no importer) |

### Critical note on #4/#5/#6 — same signature, "last write wins"
`populate_rent_cycle_fields()` has **identical signature** in 3 files (#4, #5, #6) plus the R1 retire stub (#10). PostgreSQL keeps only ONE definition. **Whichever SQL file was executed last in the Supabase editor is the live definition.** R1's `CREATE OR REPLACE … RAISE EXCEPTION` only wins if nothing re-runs `FIX_COVERAGE_DAYS_ROUNDING.sql` or `RUN_THIS_COMPLETE.sql` afterward. Until those source files are physically neutralized/archived, the retirement is **reversible by an innocent copy-paste**. This is the single biggest finding of this audit.

### #8/#9 — the second, independent engine R1 missed
`calculate_coverage()` is a *different* writer family (`FLOOR` math, IMMUTABLE) with its own STEP 6 (payments backfill) and STEP 7 (student-row update from most-recent payment). It also creates the `student_coverage_status` view + `get_dashboard_kpis` + `get_student_status` (note: returns `'PAID'`, a *different status vocabulary* than the JS classifier's `CURRENT`). R1 said nothing about this file. It is a fully independent latent writer.

---

## C. Trigger analysis (auto-writers)

**Result: ZERO triggers write any coverage field.** All `CREATE TRIGGER` statements found:

| Trigger | Function | Touches coverage? |
|---|---|---|
| `trg_update_obligation` (schema.sql) | `update_monthly_obligation` | ❌ legacy `monthly_obligations` |
| `trg_new_student_obligation` | `create_obligation_for_new_student` | ❌ obligations |
| `trg_new_user_profile` | `handle_new_user` | ❌ auth |
| `payments_recalculate_trigger` (recalculate_balances.sql / sprint4_all_fixes.sql) | `trigger_recalculate_balances` | ❌ `monthly_obligations.balance` only |

**Implication:** every SQL coverage writer is **manual-invocation only**. None fire automatically on payment insert/update. So a stale write can only happen if a human runs one of those scripts — which makes neutralizing the source files a complete fix.

## D. App RPC references

Grep of `src/` for all SQL coverage function names → **only hits are in `src/services/_archive/coverageService.legacy.js`**, which is **not imported anywhere**. The live app calls **none** of the SQL writers/readers. The live write path is exclusively JS `rebuildStudentCoverage()` (#1), reached via `recordPaymentWithCoverage`, `updatePayment`, `deletePayment`.

---

## E. Verdict

- **Authoritative writer:** exactly one — JS `rebuildStudentCoverage()` (#1), with #2/#3 delegating to its math.
- **Hidden/latent writers remaining:** **5 SQL paths** (#5, #6, #8, #9, and #4 until its source is neutralized) can still overwrite coverage with FLOOR or most-recent-only math if a human runs them.
- **Auto-writers (triggers):** none. Risk is human-invocation only.
- **Objective "exactly one writer, zero hidden writers":** **NOT YET met.** R1 covered 2 of 7 SQL writer definitions. See `SQL_RETIREMENT_MATRIX.md` for the completion plan.
