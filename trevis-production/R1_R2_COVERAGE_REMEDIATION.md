# R1 + R2 — COVERAGE SOURCE-OF-TRUTH REMEDIATION

**Date:** 2026-06-16
**Trigger:** DATA_TRUTH_AUDIT.md Findings 1 & 3 — two SQL engines (`FLOOR` rebuild,
most-recent-only backfill) could write coverage columns with wrong math.
**Goal:** One engine. One truth. Only `rebuildStudentCoverage()` (JS) writes coverage.
**Status:** R1 ✅ delivered · R2 ✅ delivered (dry-run gated; `--apply` is the operator step).
**Tests:** 169/169 still passing.

---

## R1 — Retire SQL coverage rebuild logic

**Problem:** `rebuild_student_coverage_from_payments(uuid)` (FLOOR math, loses 1 day/payment
for $110/$260 rooms) and `populate_rent_cycle_fields()` (most-recent-payment only, drops
history) are second/third writers of `students.coverage_*`. The app never calls them
(verified: no `supabase.rpc()` reference in `src/`), but they remain runnable footguns in
the SQL editor.

**Delivered:**
- `supabase/R1_retire_sql_coverage_rebuild.sql` — `CREATE OR REPLACE` both functions to
  `RAISE EXCEPTION 'RETIRED (R1)…'` so any accidental call fails **loudly** instead of
  silently overwriting correct values. (Option B drop provided as alternative.) Reversible:
  the originals remain in their source files.
- Retirement banners added to the source files
  (`phase4b3_repair_stale_coverage.sql`, `sprint5.5_rent_cycle_schema.sql`) so the dead
  logic isn't copy-pasted back.

**Deliberately NOT touched** (separate concerns, documented in the SQL):
- `recalculate_student_balances` / obligation triggers — legacy `monthly_obligations`
  cash-basis table, not coverage (TD-10).
- `student_coverage_status` view / `get_dashboard_kpis` RPC — read-only; the app uses the
  JS classifier. Read-side SQL consolidation is a smaller TD-9 follow-up.

**Operator action:** run `supabase/R1_retire_sql_coverage_rebuild.sql` in the Supabase SQL
editor. Verify both functions now raise the RETIRED exception.

---

## R2 — Full portfolio replay (fix historical drift)

```
ACTIVE students → read payment ledger → replay through JS engine → rewrite coverage fields
```

**Delivered:** `scripts/replay_portfolio_coverage.mjs` — a standalone Node runner that:
- Fetches all ACTIVE students + their full payment ledger (ordered `payment_date ASC`).
- Replays each ledger through **`processPayment`** — the *exact* pure function
  `rebuildStudentCoverage()` uses (no new/duplicate math; Rules 1 & 2).
- Compares the engine result to the stored columns and reports **drift**.
- **Defaults to `--dry-run`** (writes nothing). `--apply` must be explicit to rewrite the
  4 derived columns (`coverage_start/end`, `daily_rate`, `next_due_date`). Never touches payments.

> Note: the in-app `coverageRepairService.repairAllStudentsCoverage()` already implements the
> same replay (also via `rebuildStudentCoverage`) and can be triggered from the admin UI;
> the script is the headless/auditable equivalent that adds a dry-run drift report.

**Why non-destructive & safe:** coverage is fully derived from the immutable payment ledger.
Re-deriving it cannot lose information; worst case is reverting via the backup (or simply
re-running the replay). Verified by MONTH_BOUNDARY_VERIFICATION (17/17) that the engine is
correct across boundaries.

**Operator runbook:**
```bash
# 1. Back up (DATABASE_CLEANSING_PLAN.md §0).
# 2. Fix orphaned students first (no room rent) — see DATABASE_CLEANSING_PLAN §7.
# 3. Dry run — review the drift list:
SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node scripts/replay_portfolio_coverage.mjs --dry-run
# 4. Apply once the drift list looks right:
SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node scripts/replay_portfolio_coverage.mjs --apply
# 5. Re-run --dry-run → expect "✅ All ACTIVE students already match. No drift."
# 6. Reconcile getDashboardKPIs() in the app against the post-replay counts.
```
Expected drifters: the `$110`/`$260` FLOOR cohort and any historical-data students
(e.g. Rutendo: stored may read short; engine corrects to coverage_end 2026-07-23 / CURRENT).

---

## Order of operations (R1 vs R2)

Either order is safe (R1 only removes write paths; it changes no data). Recommended:
**R2 dry-run → R1 retire → R2 apply → R2 dry-run verify.** This guarantees that after the
correct values are written, nothing can overwrite them with FLOOR math again.

## Result

- ✅ **One writer** of coverage: JS `rebuildStudentCoverage()`. SQL writers retired (loud-fail).
- ✅ **Replay tool** ready, dry-run-gated, reusing the authoritative engine.
- ✅ Tests 169/169. No app code paths changed (mutation chain already correct per RELIABILITY_AUDIT).
- ⏭️ Remaining operator step: run R1 SQL + R2 `--apply` against production (gated, backed up).
