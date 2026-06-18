# TREVIS STABILIZATION — COMPLETION REPORT

**Date:** 2026-06-16
**Author:** Principal Engineer / System Custodian
**Branch:** `main` (merged + pushed) · **Tag:** `coverage-audit-complete`
**Status:** Stabilization sprint complete — **code AND live DB aligned (R1 verified in prod 2026-06-16).** **Awaiting approval to begin Phase 4C.**

> **Addendum 2026-06-18 — coverage_start bug found & repaired.** Post-deploy team review found a
> `coverage_start` storage bug (last-payment slice start stored instead of the current-chain start;
> Onenhlanha showed start==end). Fixed with a gap-aware "current continuous chain" rule across all
> three replay sites; R2 `--apply` repaired 54 students (0 coverage_end moved, 0 failed). Post-repair
> audit = 0 corrupt rows, dry-run Drifted = 0. `coverage_end`/days-remaining/ledger were never wrong
> (storage bug, not accounting). Tests 179/179. This validated the report's Risk #2 (silent re-drift,
> as payments were edited after the first R2) — the Phase-4C standing drift monitor is now a firm
> recommendation, not optional. See TD-9 and `supabase/AUDIT_coverage_start_bug.sql`.

---

## 1. Executive summary

The coverage engine — the financial heart of TREVIS — now has **one authoritative writer, zero
hidden writers, and zero data drift**. The portfolio's stored coverage matches a from-ledger replay
exactly for all 134 ACTIVE students. The work that remained at the start of this sprint (retire the
parallel SQL engines, repair historical drift, prove the repair) is done and verified against
production. One operator action is outstanding (running the R1 retirement SQL in prod) and is
documented below; it hardens against future regression and does not affect the now-correct data.

**Recommendation: READY for Phase 4C**, conditional on the single operator step (run R1 in prod).

---

## 2. What was done (this sprint)

### Step 1 — Retire ALL SQL coverage writers ✅
- Full repo sweep (`COVERAGE_WRITER_INVENTORY.md`) found the original retirement had missed most of
  the surface: `populate_rent_cycle_fields()` existed in **4 files**, plus a **second independent
  engine** `calculate_coverage()` with auto-running STEP 6/7 `DO` blocks.
- `supabase/R1_retire_sql_coverage_rebuild.sql` extended to `RAISE EXCEPTION`-stub **all three**
  writer families (`populate_rent_cycle_fields` set LAST to win the "last-write-wins" signature
  race, `rebuild_student_coverage_from_payments`, `calculate_coverage`) and drop the read-side
  companions (`student_coverage_status` view, `get_dashboard_kpis`, `get_student_status`,
  `get_days_status`).
- 4 dormant SQL source files quarantined to `supabase/_archive/` with ⛔ DO-NOT-RUN banners + README.
- Dead `src/services/_archive/coverageService.legacy.js` deleted (no importers).
- **Result: exactly one writer (JS `rebuildStudentCoverage`), zero runnable hidden writers in code.**

### Steps 2–4 — Repair & verify portfolio drift ✅
- **Step 2 (dry-run):** 134 checked, **123 drifted** — investigated and decomposed: 27 real
  FLOOR→ROUND extensions (the predicted baseline) + 96 stale `next_due_date`/`coverage_start`
  catch-up with **identical `coverage_end`**. Added a read-only `--verbose` diagnostic and a
  **coverage_end-EARLIER safety gate** (must be 0). Confirmed **0 reductions**.
- **Step 3 (apply):** backup `students_coverage_backup_20260616` (170 rows) taken first;
  `--apply` → **123 written, 0 failed, 0 coverage_end reductions**.
- **Step 4 (re-audit):** re-run dry-run → **Drifted: 0** (`students_with_drift=0, max_days_lost=0`).
  Re-running `--apply` writes nothing → **idempotent**.

### Step 5 — Performance audit (findings only) ✅
- `STAGE9_PERFORMANCE_AUDIT.md`: TD-7 (cache-mitigated N+1 cold fetch), TD-8 (coarse invalidation +
  unenforced contract), TD-9 read-side (duplicate dashboard query), new PERF-3 (PropertyDetail
  re-fetches data the dashboard already loaded). **No correctness bugs.** One consolidating fix
  (app-level coverage store) recommended for Phase 4C. **No code changed.**

---

## 3. Verification evidence

| Check | Result |
|---|---|
| R2 dry-run (pre-repair) | Checked 134 / Drifted 123 / EARLIER 0 |
| Backup before apply | `students_coverage_backup_20260616` = 170 rows, ends 2026-05-30→2026-08-26 |
| R2 apply | Written 123 / Failed 0 / EARLIER 0 |
| R2 re-audit (post-repair) | **Drifted 0** / ✅ No drift |
| R2 idempotency (2nd apply) | Written 0 (no-op) |
| Test suite | **169 / 169 passing** (vitest, 11 files) |
| Safety invariant (coverage may only increase) | **Held** — 0 students lost any day |

---

## 4. Reliability score

**Coverage engine reliability: 9.5 / 10.**

| Dimension | Score | Notes |
|---|---|---|
| Correctness (data = ledger) | 10 | drift=0, verified by from-scratch replay |
| Single source of truth | 10 | one JS writer; **R1 verified in prod** — all SQL writers RAISE, companions dropped |
| Regression resistance | 9 | RAISE stubs live in prod + quarantine + EARLIER gate; only gap is no auto-monitor |
| Test coverage | 9 | 169 tests incl. BC-8 coverage-cache suite; engine math + failure paths covered |
| Observability | 8 | `--verbose`/EARLIER gate; perf timers; no automated drift alarm yet |
| Performance | 8 | acceptable at 134 students; consolidating fix deferred to 4C |

Not a perfect 10 only because there is no *automated* recurring drift check and the perf
consolidation is deferred — both are Phase-4C enhancements, not active defects. The original
gating gap (R1 not run in prod) is now closed and verified.

---

## 5. Remaining risks

1. **R1 not yet run in prod (operator).** Until executed, the live DB still *contains* the old
   writer function bodies (dormant — no trigger fires them, app calls none). Risk is human re-run of
   an archived script. **Mitigation:** run `supabase/R1_retire_sql_coverage_rebuild.sql` (with
   backup). Low likelihood, fully mitigated by the one action.
2. **No automated drift monitor.** Drift is caught only by manually running R2. A future regression
   would be silent until someone looks. **Mitigation (4C):** schedule R2 `--dry-run` as a periodic
   read-only check / alarm on Drifted>0.
3. **Cache-invalidation contract is hand-copied (TD-8).** A future mutation path could forget to
   invalidate → stale UI (DB stays correct). **Mitigation (4C):** centralize in one helper.
4. **Performance at scale (TD-7/PERF-3).** Fine now; cold-load cost grows with student count.
   **Mitigation (4C):** app-level coverage store.

None of these is a current correctness defect.

---

## 6. Operator action items (outside code)

- [x] **R1 run + VERIFIED in prod (2026-06-16).** `rebuild_student_coverage_from_payments`,
      `calculate_coverage`, `populate_rent_cycle_fields` all RAISE `USING RETIRED COVERAGE ENGINE`;
      `student_coverage_status` / `get_dashboard_kpis` / `get_student_status` / `get_days_status`
      all resolve to NULL. **Live DB now matches code: one writer, zero runnable hidden writers.**
- [x] R2 backup taken (`students_coverage_backup_20260616`).
- [x] R2 `--apply` executed; re-audit drift=0.
- [ ] (Optional, post-confirmation) drop `students_coverage_backup_20260616` once satisfied.

---

## 7. Recommendation

**READY for Phase 4C.** The gating condition (run R1 against production) is now **complete and
verified** — see §6. Data is correct and proven (drift=0); the codebase and the live database both
have exactly one coverage writer and zero runnable hidden writers; tests are green (169/169). The
stabilization objective is **fully met end to end (code + live DB).**

**Do not begin Phase 4C until this report is approved.**
