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

## TD-2 🔴 Two clocks on the Dashboard (coverage KPI vs month-based table)
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

## TD-3 🔴 Finances/Arrears page never migrated to coverage
- **Where:** `src/parts/p7_arrears.jsx` — **zero** coverage imports.
- **What:** Buckets by *days since last payment* (0–30/31–60/60+) and derives status from
  `balance = rent − paid`. Sprint 5.5 explicitly planned coverage-status filters (Current /
  Expiring Soon / Due Today / Overdue, sorted by `coverage_end`); not done.
- **Risk:** The page literally dedicated to arrears uses the wrong (month/aging) definition of
  overdue — the most visible instance of TD-2.
- **Fix:** Rebuild Finances on `getAllStudentsCoverage` + `classifyStudent`; filter/sort by coverage
  status and `coverage_end`; show days remaining/overdue and outstanding = days_overdue × daily_rate.

## TD-4 🟠 Global Students list filter is legacy status
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

## TD-9 🟡 KPI source inconsistency (JS classify vs SQL RPC)
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
