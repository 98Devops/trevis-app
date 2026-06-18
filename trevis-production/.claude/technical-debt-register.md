# Trevis — Technical Debt Register

Built 2026-06-15 from a full source read. Each item: where it lives, why it's debt, risk, and a
suggested resolution. Severity = impact on **correctness/trust** first, then performance/maintenance.
**No code has been changed** — this is analysis only.

Legend: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

---

## TD-1 ✅ RESOLVED (Stage 4) — Dual coverage engines (wrong-math trap)
> **Resolved 2026-06-15.** `coverageService.js` had zero source imports (verified via
> `grep -rn coverageService src`). Moved via `git mv` to
> `src/services/_archive/coverageService.legacy.js` with a "DEAD CODE — DO NOT IMPORT"
> banner explaining the wrong-math behavior and pointing to the authoritative engine
> (`rentCycleCalculator.js` → `paymentProcessor.js` → `statusClassifier.js` →
> `coverageDatabaseService.js`). Stale Sprint 5.5 docs
> (`SPRINT5.5_FLEXIBLE_RENT_CYCLES.md`, `SPRINT5.5_IMPLEMENTATION_STATUS.md`) corrected
> with notices. 150/150 tests still pass (no test ever depended on the file). See
> `STABILIZATION_TD1_ORPHANED_ENGINE_REMOVED.md`. Original analysis below.

- **Where:** `src/services/coverageService.js` vs the authoritative
  `rentCycleCalculator.js` + `paymentProcessor.js` + `statusClassifier.js` + `coverageDatabaseService.js`.
- **What:** `coverageService.js` computes `daysCovered = Math.floor(...)` (engine uses `Math.round`),
  always sets `coverage_start = payment_date` (no early-payment / prepaid preservation), writes
  wrong column names (`date`, `method` instead of `payment_date`, `payment_method`), and uses a
  different status mapping (`>7 ⇒ "PAID"`). It calls the SQL `get_dashboard_kpis` RPC.
- **Risk:** It is currently **orphaned** (no `.jsx`/service imports it — only the Sprint 5.5 docs
  reference it). But it is a loaded gun: any future wiring reintroduces the exact prepaid-day-loss
  and off-by-one-day bugs Phase 1/2 fixed, and a second, contradictory status definition.
- **Fix:** Delete `coverageService.js` (preferred) or move it to an `_archive/` folder with a
  header banner. Update `SPRINT5.5_IMPLEMENTATION_STATUS.md` / `SPRINT5.5_FLEXIBLE_RENT_CYCLES.md`
  which still point at it. Verify no import via `grep -rn coverageService src`.

## TD-2 ✅ RESOLVED (Stage 5) — Two clocks on the Dashboard (coverage KPI vs month-based table)
> **Resolved 2026-06-15.** The Attention Required table (rows + count + badges), the
> per-property card "Alerts" count, and the mobile cards now derive from the SAME
> coverage engine as the KPI strip (`statusClassifier.classifyStudent`), via a single
> `getAllStudentsCoverage()` fetch (no N+1) and a pure, tested helper
> `src/services/dashboardAttention.js` (`buildAttentionList` / `countAttentionByProperty`).
> Attention "Balance" → "Outstanding" = days_overdue × daily_rate. Cash figures
> (Collected/Arrears/bar chart) kept but relabelled "(mo) / monthly cash basis" so
> they're not confused with status. Legacy month list retained only as a demo/fetch-failed
> fallback. 10 new tests in `dashboardAttention.test.js`; 160/160 passing. See
> `STABILIZATION_TD2_DASHBOARD_UNIFICATION.md`. Original analysis below.


- **Where:** `src/parts/p4_dashboard.jsx`. Top KPI strip ← `getDashboardKPIs` (coverage). Property
  cards "Arrears"/"Alerts", the bar chart, and the **Attention Required** table ← `buildProps`
  month status (`paid>=rent?PAID:...`).
- **What:** "Overdue = N" (coverage) and the Attention list length (month) are computed from
  different definitions and will diverge (e.g. a student fully covered via prepayment but with $0
  paid *this* calendar month appears in Attention yet is "Current" in the KPI).
- **Risk:** Exactly the "two versions of truth" the Phase 4 authorization forbade. Erodes operator
  trust; "why does the dashboard say 3 overdue but the list shows 7?"
- **Fix:** Drive the Attention table, Alerts, and the property-card status counts from coverage
  classification (reuse `classifyPortfolio` / the per-student coverage already fetched). Keep
  cash figures (collected/expected) clearly labelled as monthly, separate from status.

## TD-3 ✅ RESOLVED (Stage 6) — Finances/Arrears page never migrated to coverage
> **Resolved 2026-06-16.** `p7_arrears.jsx` rewritten on `getAllStudentsCoverage` +
> `classifyStudent`: coverage-status filter chips (All/Current/Expiring Soon/Due
> Today/Overdue) replace aging buckets; sorts by `coverage_end` asc; Outstanding =
> days_overdue × daily_rate via the SHARED `coverageOutstanding()` helper (same formula
> as the Dashboard Attention table & getDashboardKPIs). Cash figures kept but relabelled
> monthly. Consistency locked by tests: outstanding parity with Attention, and overdue
> count parity with `classifyPortfolio` (the Dashboard KPI). +8 tests; 168/168 passing.
> See `STABILIZATION_TD3_FINANCES_COVERAGE_MIGRATION.md`. Original analysis below.


- **Where:** `src/parts/p7_arrears.jsx` — **zero** coverage imports.
- **What:** Buckets by *days since last payment* (0–30/31–60/60+) and derives status from
  `balance = rent − paid`. Sprint 5.5 explicitly planned coverage-status filters (Current /
  Expiring Soon / Due Today / Overdue, sorted by `coverage_end`); not done.
- **Risk:** The page literally dedicated to arrears uses the wrong (month/aging) definition of
  overdue — the most visible instance of TD-2.
- **Fix:** Rebuild Finances on `getAllStudentsCoverage` + `classifyStudent`; filter/sort by coverage
  status and `coverage_end`; show days remaining/overdue and outstanding = days_overdue × daily_rate.

## TD-4 ✅ RESOLVED (Stage 7) — Global Students list filter is legacy status
> **Resolved 2026-06-16.** `Students` function in `p5_views.jsx` rewritten to fetch
> `getAllStudentsCoverage()` once (refetch on `[props]`), build a `coverageMap`, and
> drive filter chips (All/Current/Expiring Soon/Due Today/Overdue) and per-row badges
> from `classifyStudent` — the same function `PropertyDetail`/`RoomRow` use. The legacy
> PAID/PARTIAL/OVERDUE chips and badges are gone. Loading state shows `…` to prevent
> stale-badge flash. Cross-view consistency pinned by test. 169/169 passing. See
> `STABILIZATION_TD4_STUDENTS_VIEW_COVERAGE.md`. Original analysis below.


- **Where:** `src/parts/p5_views.jsx` `Students` — filter chips PAID/PARTIAL/OVERDUE and the
  per-row `Badge` use `buildProps` `s.status`, not coverage.
- **Risk:** Inconsistent with the coverage badges shown inside PropertyDetail room rows; same
  student can read "Partial" here and "Current" there.
- **Fix:** Use coverage classification for the global list too (it already fetches per-property
  coverage elsewhere; extend to the global list or fetch once at app level).

## TD-5 ✅ RESOLVED (Stage 2) — Best-effort coverage rebuild swallows errors (silent failure)
> **Resolved 2026-06-15.** `paymentService` (`rebuildCoverageSafely`, one retry) and
> `coverageDatabaseService.recordPaymentWithCoverage` now return `rebuildError`; all UI handlers
> surface it (toast/alert) instead of reporting clean success. Missing cache invalidation in inline
> edits also fixed. 5 tests in `paymentRebuildFailure.test.js`. See
> `STABILIZATION_TD5_SILENT_REBUILD_FAILURES.md`. Original analysis below.

- **Where:** `paymentService.updatePayment` / `deletePayment` — `try { rebuildStudentCoverage } 
  catch { console.error(...) }` with comment "don't fail the update."
- **What:** If the rebuild throws (network, room rent missing, etc.), the payment row is already
  changed but coverage is **stale**, and the user sees success.
- **Risk:** Violates "no silent failures." Coverage silently drifts from the ledger; only the
  manual repair tool would catch it.
- **Fix:** Propagate the rebuild error to the caller and toast it; offer/auto-trigger
  `repairStudentCoverage`; consider doing the write + rebuild server-side in one RPC/transaction.

## TD-6 ✅ RESOLVED (Stage 3) — No duplicate-submit guard on payments
> **Resolved 2026-06-15.** UI in-flight guards added to create (`isSubmitting`) and delete
> (`isDeleting`); edit already guarded by `InlineEditField.isSaving`. Service-layer idempotency:
> `recordPaymentWithCoverage` suppresses an identical payment (same student/amount/date) within a
> 10s window. 2 tests in `duplicatePaymentProtection.test.js`. See
> `STABILIZATION_TD6_DUPLICATE_PAYMENT_PROTECTION.md`. Original analysis below.

- **Where:** `PaymentModal` / `handleRecordPayment` (App.jsx) — button not disabled during the
  async insert+rebuild.
- **Risk:** Double-click ⇒ two payment rows ⇒ inflated coverage (deterministic rebuild faithfully
  sums both). Hard to notice; corrupts billing.
- **Fix:** Disable the submit button while in flight; ideally an idempotency key or
  recent-duplicate check (same student/amount/date within N seconds).

## TD-7 🟡 N+1 per-student coverage fetch
- **Where:** `p5_views PropertyDetail` — `studentsToFetch.map(getStudentCoverageData)` in
  `Promise.all` (one round-trip per uncached student) + a separate `getDashboardKPIs`.
- **Risk:** Cold-load latency scales with student count; redundant with `getAllStudentsCoverage`
  which can return everything in one query.
- **Fix:** Batch into a single query/view per property (or reuse one app-level coverage fetch).
  Cache already mitigates repeat visits, but first paint is still O(students).

## TD-8 🟡 Coarse cache invalidation + implicit contract
- **Where:** every mutation does `setCoverageCache(new Map())`.
- **Risk:** Nukes all cached students on any single change; correctness depends on every future
  mutation *remembering* to invalidate (no enforced wrapper). Fine at current scale, fragile later.
- **Fix:** Invalidate per-student (delete the touched id), and centralize mutation+invalidation in
  one helper so it can't be forgotten.

## TD-9 ✅ FULLY CLOSED (code + data + live DB) — Coverage source-of-truth split (JS vs SQL)
> **coverage_start BUG FOUND + FIXED + REPAIRED 2026-06-18.** A raw-table query (team review)
> surfaced Onenhlanha Nyathi with `coverage_start == coverage_end == 2026-07-24` (a 1-day window
> that can't hold "91 days paid"). Root cause: `rebuildStudentCoverage()` and R2 stored the LAST
> payment's *slice* start as the student's `coverage_start`; for a long-term tenant whose final
> payment is a small early/stacked slice, that collapses to start==end. `coverage_end`,
> days-remaining, and the ledger were always correct (and no UI reads `coverage_start`), so it was a
> storage/presentation bug, not an accounting bug. FIX: store the start of the CURRENT CONTINUOUS
> chain (resets after a coverage gap via `processPayment.isEarlyPayment`), applied in lockstep to
> `rebuildStudentCoverage`, R2 `replayLedger`, and `coverageBreakdown`. REPAIR: R2 `--apply` rewrote
> **54** students' `coverage_start` (backup `students_coverage_backup_20260618`; **0 coverage_end
> moved**, 0 failed). Post-repair audit `coverage_start >= coverage_end` = **0**; dry-run **Drifted:
> 0**. Onenhlanha now `2026-05-25 → 2026-07-24` (gap-aware: his 2025 coverage had lapsed). Tests
> 179/179. Also exposed silent re-drift (payments edited after the first R2) → reinforces the need
> for the Phase-4C standing drift monitor. See `supabase/AUDIT_coverage_start_bug.sql`.
>
> **DATA REPAIRED 2026-06-16 20:02 UTC (R2 `--apply`).** Backup `students_coverage_backup_20260616`
> (170 rows) taken first. `--apply`: 134 checked, 123 written, **0 failed, 0 coverage_end reductions**
> (27 real FLOOR→ROUND extensions +1/+2 days; 96 stale next_due_date/coverage_start catch-up with
> unchanged coverage_end). Re-audit dry-run: **Drifted: 0** — `students_with_drift=0, max_days_lost=0`.
> Stored coverage now equals the JS engine for every ACTIVE student; R2 is idempotent (re-apply = no-op).
> See `COVERAGE_PARITY_AUDIT.md` (repaired header).
>
> **R1 RUN + VERIFIED IN PROD 2026-06-16.** All three writers (`rebuild_student_coverage_from_payments`,
> `calculate_coverage`, `populate_rent_cycle_fields`) now RAISE `USING RETIRED COVERAGE ENGINE`; the
> read-side companions (`student_coverage_status` view, `get_dashboard_kpis`, `get_student_status`,
> `get_days_status`) all resolve to NULL. **Live DB matches code: one writer, zero runnable hidden
> writers. TD-9 fully closed (code + data + live DB).**
>

> **RETIREMENT COMPLETED 2026-06-16 (extended R1).** The full sweep
> (`COVERAGE_WRITER_INVENTORY.md`) found `populate_rent_cycle_fields()` in **4 files** and a
> **second engine** `calculate_coverage()` + auto-running backfill blocks that the original R1
> never touched. R1 (`supabase/R1_retire_sql_coverage_rebuild.sql`) was **extended to retire
> all three writer families** — `populate_rent_cycle_fields` (set LAST in run order to win the
> "last write wins" signature race), `rebuild_student_coverage_from_payments`, and
> `calculate_coverage` — each now `RAISE EXCEPTION 'USING RETIRED COVERAGE ENGINE...'`, and the
> read-side companions (`student_coverage_status` view, `get_dashboard_kpis`,
> `get_student_status`, `get_days_status`) are dropped. The 4 dormant source files were moved to
> `supabase/_archive/` with ⛔ DO-NOT-RUN banners + README, and dead
> `_archive/coverageService.legacy.js` was deleted. **One writer (JS rebuildStudentCoverage),
> zero runnable hidden writers.**
>
> **Remaining (not code):** (a) OPERATOR runs the updated R1 against prod (with backup) so the
> live DB definitions become the stubs; (b) R2 `--dry-run` then `--apply` corrects the measured
> historical drift (27/134 students, 1–3 days, all undercount — `COVERAGE_PARITY_AUDIT.md`).
> Mitigating facts that bounded the risk all along: NO trigger auto-fires any writer
> (human-invocation only), and the live app called NONE of them.
>
> _Prior (over-claimed) note:_ Stage 8.1 (`DATA_TRUTH_AUDIT.md`) proved the SQL
> `rebuild_student_coverage_from_payments` (FLOOR) and `populate_rent_cycle_fields`
> (most-recent-only) wrote coverage columns with wrong math, diverging from the JS engine.
> **R1** retired those two functions (loud `RAISE EXCEPTION`; see
> `supabase/R1_retire_sql_coverage_rebuild.sql`). **R2** added
> `scripts/replay_portfolio_coverage.mjs` (dry-run-gated full portfolio replay through the
> same engine) to correct historical drift. See `R1_R2_COVERAGE_REMEDIATION.md`. Read-side
> note: the `student_coverage_status` view /
> `get_dashboard_kpis` RPC remain (unused by app; app uses JS classifier) — retiring those
> read-only duplicates is a small remaining follow-up. Original analysis below.


- **Where:** `coverageDatabaseService.getDashboardKPIs` classifies in JS; the SQL
  `get_dashboard_kpis` RPC and `student_coverage_status` view also exist (used only by orphaned
  `coverageService`). Two coverage-status implementations (JS + SQL) can drift.
- **Fix:** Pick one authority (JS `statusClassifier` is the documented one) and remove/retire the
  SQL status logic, or make the SQL view delegate to the same thresholds and test parity.

## TD-10 🟡 Doc/code drift on status vocabulary
- **Where:** `.kiro/.../CRITICAL_BUSINESS_RULES.md` ("use CHECKED_OUT, don't use VACATED") vs code
  filtering `status != 'VACATED'` and demo data using `PAID/PARTIAL/OVERDUE` as a *status* value.
- **Risk:** Confusion about the canonical student-status set (ACTIVE / VACATED / CHECKED_OUT) and
  which are excluded from metrics.
- **Fix:** Define the status enum in one place (constant + comment), align docs, and make
  `classifyStudent`'s "non-ACTIVE ⇒ EXCLUDED" rule match the documented vocabulary.

## TD-11 🟢 New student with no payment shows OVERDUE
- **Where:** `statusClassifier.classifyStudent` — ACTIVE + `coverage_end == null` ⇒ OVERDUE
  ("No coverage recorded").
- **Risk:** A just-added student (no payment yet) reads as Overdue, which may misrepresent intake.
- **Fix:** Consider a distinct `NEW`/`UNCOVERED` state, or scope OVERDUE to students past an
  expected first-payment date. Product decision required.

## TD-12 🟢 Calendar view not coverage-aware
- **Where:** `src/parts/p8_calendar.jsx` — no coverage imports.
- **Fix:** Surface coverage-end/next-due dates on the calendar once Lineage A is the standard.

## TD-13 🟢 Build/observability hygiene
- **Where:** `build_app.cjs` legacy concatenation script (not used by Vite); heavy `console.log`
  /`console.time` instrumentation left in `p5_views`, dashboard, context.
- **Fix:** Remove/relocate `build_app.cjs` or document it as legacy; gate verbose logs behind a
  debug flag; route to a real logger for production observability.

## TD-14 🟢 Phase 4B.11 changes uncommitted
- **Where:** working tree (`App.jsx`, `p3_modals.jsx`, `coverageCache.test.js`).
- **Risk:** Edit/delete cache invalidation + BC-9 tests aren't in git; a reset would lose them and
  reintroduce the "must press F5 after edit" bug.
- **Fix:** Run `npm test`, verify green, commit + tag per `PHASE4B.11_COMPLETE.md`.

---

## Suggested remediation order
1. TD-14 (commit current work — protect what's done).
2. TD-1 (delete orphaned wrong-math engine — cheap, removes a trap).
3. TD-5 + TD-6 (stop silent failures and double-submits — data-integrity).
4. TD-2 → TD-3 → TD-4 (unify UI on coverage — the trust fix; the big one).
5. TD-7 / TD-8 / TD-9 (performance + consistency).
6. TD-10 / TD-11 / TD-12 / TD-13 (cleanup, product decisions).
