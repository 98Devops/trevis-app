# SQL RETIREMENT MATRIX

**Date:** 2026-06-16 · **Read-only audit — no modifications executed.**
**Goal:** Get from "5 latent coverage writers" to "exactly one authoritative writer, zero hidden writers."
**Companion:** `COVERAGE_WRITER_INVENTORY.md`.

---

## Classification

### 🔴 RETIRE (latent coverage writers — must be neutralized)

| Artifact | Why retire | Action |
|---|---|---|
| `FIX_COVERAGE_DAYS_ROUNDING.sql` → `populate_rent_cycle_fields()` | 2nd copy of the function; most-recent-only; **NOT covered by R1**. Re-running re-installs a bad writer over the R1 stub. | Replace body with `RAISE EXCEPTION 'RETIRED'` **or** move file to `supabase/_archive/`. Extend R1 script to cover this signature. |
| `RUN_THIS_COMPLETE.sql` → `populate_rent_cycle_fields()` | 3rd copy, same risk. Filename invites a full re-run. | Same as above. |
| `sprint5.5_flexible_rent_cycles_CORRECTED.sql` → `calculate_coverage()` + STEP 6/7 blocks | Independent FLOOR engine + auto-running `DO` blocks that overwrite student coverage on execution. R1 never touched it. | Archive the file; add `DROP FUNCTION IF EXISTS calculate_coverage(...)` to R1 (or stub it). |
| `sprint5.5_flexible_rent_cycles.sql` (non-CORRECTED) | Older duplicate of the above. | Archive. |
| `sprint5.5_rent_cycle_schema.sql` → `populate_rent_cycle_fields()` | Original definition. Has R1 banner, but the function body is still present and re-runnable. | Already banner'd; extend R1 retire stub to guarantee the live DB definition is the exception stub. |
| `phase4b3_repair_stale_coverage.sql` → `rebuild_student_coverage_from_payments()` | FLOOR replay. Has R1 banner; R1 stub covers this signature. | Confirm R1 stub applied in DB. Keep STEP-1 diagnostic SELECT (read-only). |

### ✅ PRESERVE (not coverage writers / still needed)

| Artifact | Why keep |
|---|---|
| `schema.sql` (tables, obligation/auth triggers) | Base schema. No coverage writes. |
| `recalculate_balances.sql`, `sprint4_all_fixes.sql` (`recalculate_student_balances`, balance trigger) | Legacy `monthly_obligations` cash basis (TD-10) — separate concern, no coverage fields. |
| `execute_student_transfer()` (4 files) | **Audited: does NOT write coverage fields.** Transfer logic only. Keep (consolidate duplicates separately). |
| `sprint5_performance_indexes.sql`, coverage indexes | Read performance. Keep. |
| All `VERIFY_*` / `*_verification*` / `PHASE1_VALIDATION_AUDIT.sql` | Read-only diagnostics. Keep — useful for parity checks. |
| `R1_retire_sql_coverage_rebuild.sql` | The remediation itself. Keep + extend (below). |

### ✏️ REWRITE / EXTEND

| Artifact | Change |
|---|---|
| `R1_retire_sql_coverage_rebuild.sql` | **Extend** to also `RAISE EXCEPTION`-stub `calculate_coverage(numeric,numeric,date)` and to re-stub `populate_rent_cycle_fields()` *last* in run order. Currently it only covers 2 of the writer signatures. Add a verification query that asserts all writer functions raise. |
| `student_coverage_status` view + `get_dashboard_kpis()` + `get_student_status()` + `get_days_status()` | Read-side SQL, unused by live app but uses a divergent `'PAID'` vocabulary. **Drop** to eliminate confusion (TD-9 read-side follow-up), OR document as deprecated. Low urgency — not consumed. |

### ☠️ DEAD (remove opportunistically)

| Artifact | Note |
|---|---|
| `src/services/_archive/coverageService.legacy.js` | Only thing referencing the SQL view/RPC. Unimported. Safe to delete. |

---

## Completion criteria for "one writer, zero hidden writers"

1. ☑ **DONE (code).** Extended R1 so it `RAISE EXCEPTION`-stubs `populate_rent_cycle_fields` (last in run order), `rebuild_student_coverage_from_payments`, AND `calculate_coverage`, plus drops the read-side companions. **Operator must run the updated `R1_retire_sql_coverage_rebuild.sql` against prod** for the live DB definitions to become the stubs. Verification SELECTs are at the bottom of the script.
2. ☑ **DONE.** Archived `FIX_COVERAGE_DAYS_ROUNDING.sql`, `RUN_THIS_COMPLETE.sql`, both `flexible_rent_cycles*.sql` → `supabase/_archive/` (via `git mv`), each with a ⛔ DO-NOT-RUN guard banner + `supabase/_archive/README.md`.
3. ☑ **DONE (in R1).** R1 now `DROP`s the unused `student_coverage_status` view + `get_dashboard_kpis` / `get_student_status` / `get_days_status` RPCs (no longer "optional" — folded into the one retirement script).
4. ☑ **DONE.** Deleted dead `src/services/_archive/coverageService.legacy.js` (`git rm`; verified no importers).
5. ☑ **DONE (code).** Writer grep over `src/` → only JS `rebuildStudentCoverage()` remains. SQL writers exist only as RAISE stubs (live after operator runs R1) + quarantined archive copies.

**Code/repo steps are complete. The one remaining step is OPERATOR-ONLY: run the updated R1 against production (with backup) so the live DB function definitions become the RAISE stubs.** No production DB write was performed here.
