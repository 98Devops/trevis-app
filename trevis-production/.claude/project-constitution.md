# Trevis — Project Constitution

> **Purpose of this document.** This is the persistent, authoritative context for the Trevis
> codebase. It is built from a full read of the source, the SQL-backed services, the Sprint 5.5
> / Phase 4 documentation, and the git history. It is written to be loaded as context before any
> code is touched. Where the docs and the code disagree, **the code wins** and the disagreement is
> recorded here and in `technical-debt-register.md`.
>
> Last built: 2026-06-15 · Branch: `sprint5-5-ui-work` · HEAD: `536820d` (Phase 4B.10 docs).
> Note: working tree has **uncommitted** Phase 4B.11 changes (`App.jsx`, `p3_modals.jsx`,
> `coverageCache.test.js`) — Phase 4B.11 is implemented but not yet committed.

---

## 1. Business Purpose

**What Trevis does.** Trevis is a property-management system for **4 student-accommodation
properties in Harare, Zimbabwe**: *King Fisher*, *The Chase*, *Madden*, *NEW HOUSE*. It tracks
rooms, beds, students (tenants), and rent payments, and tells the operator who has paid, who is
about to lapse, and who is overdue.

**Who uses it.**
- **ADMIN** — full access to all 4 properties. Can add/remove students, add/remove rooms, view
  Data-Quality flags, export reports, change settings. Access is gated by an email allowlist
  (`p1_imports_context.jsx`) *and* a DB `role`.
- **MANAGER** — scoped to a single property via `profiles.property_id`, enforced at the Postgres
  level by RLS. Can record payments only.

**How money flows.** A student is assigned to a bed in a room. Each room has `rent_per_bed`
(monthly). A student pays an amount on a date; that payment buys a number of **days of coverage**
(`amount ÷ daily_rate`, where `daily_rate = monthly_rent / 30`). Coverage accumulates forward in
time. The operator's job is to keep every active student "covered."

**How room management works.** Properties → Rooms (`bed_capacity`, `rent_per_bed`) → Students.
Vacant beds are `bed_capacity − occupied`. Rooms can only be removed when empty. Students are
soft-deleted (status flips to `VACATED`/`CHECKED_OUT`; payment history is preserved).

**How student coverage works (the core model — Sprint 5.5).** Billing is **NOT** calendar-month.
Each student has an individual rolling coverage window:
- `daily_rate = round(monthly_rent / 30, 2)`
- `coverageDays = round(amount / daily_rate)` (round, never floor — see §6)
- A payment whose date falls **on/before** the current `coverage_end` is an **early payment**: new
  coverage starts at `coverage_end + 1 day` so prepaid days are never lost (coverage *stacks*).
- A payment after coverage expired starts a fresh window at `payment_date`.
- Status is derived from `coverage_end` vs today (see §3), never from the calendar.

**How payments affect operations.** Every create/edit/delete of a payment triggers a **full
deterministic rebuild** of that student's coverage from their entire payment history
(`rebuildStudentCoverage`). Coverage is *derived data*; the payment ledger is the source of truth.

---

## 2. Architecture

**Stack.** React 19 + Vite 8 (frontend) · Supabase / PostgreSQL (backend, auth, RLS) ·
Vitest (tests). No TypeScript (JS + JSDoc). Deployed static build (`dist`) on Netlify.

### Frontend architecture
The app is intentionally split into numbered "parts" under `src/parts/` (a single logical app
file broken up for maintainability; `build_app.cjs` is a legacy concatenation helper, not used by
the Vite build):
- `p1_imports_context.jsx` — `AuthProvider` + `DataProvider` (React Context), service re-exports.
- `p2_helpers.jsx` — design tokens (`T`), shared components (`Badge`, `Stat`, `Bar`, `Btn`),
  and **`buildProps()`** (the legacy month-based UI data transform — see §5/§6 risks).
- `p3_modals.jsx` — Login, Add Student wizard, Add Room, **PaymentModal**, **StudentProfile**
  (payment edit/delete live here).
- `p4_dashboard.jsx` — Dashboard (KPI strip + chart + property cards + Attention table).
- `p5_views.jsx` — PropertyDetail, RoomRow, global Students list.
- `p6_reports.jsx` — Reports + Data Quality.
- `p7_arrears.jsx` — "Finances" (arrears / aging) view.
- `p8_calendar.jsx` — Calendar view.
- `p9_settings.jsx` — Settings.
- `App.jsx` — shell, navigation, modal orchestration, **coverage cache state owner**.

### State architecture
- **AuthContext** — current `user` (with `role`, `property_id`), session lifecycle, email allowlist.
- **DataContext** — `properties` (raw Supabase rows), `loading`, `refresh()`. `refresh()` refetches
  all properties via `getProperties()`.
- **App-level coverage cache** — `coverageCache: Map<studentId, classification>` +
  `coverageCacheTimestamp`, owned by `AppInner`, passed down to PropertyDetail and StudentProfile.
- React-local state for views, modals, filters, toasts.

### Coverage engine architecture (the authoritative engine)
Pure → impure layering:
```
rentCycleCalculator.js   (pure math: daily rate, coverage days, period, next due date)
        ↓
paymentProcessor.js      (pure: early-payment detection, prepaid-day preservation, processPayment)
        ↓
statusClassifier.js      (pure: classifyStudent / classifyPortfolio → CURRENT/EXPIRING_SOON/DUE_TODAY/OVERDUE/EXCLUDED)
        ↓
coverageDatabaseService.js  (ONLY coverage service that touches Supabase: recordPaymentWithCoverage,
                             rebuildStudentCoverage, getDashboardKPIs, getStudentCoverageData,
                             getAllStudentsCoverage)
coverageRepairService.js    (one-shot/utility rebuild + verify against payment history)
```

### Database architecture
Tables: `properties`, `rooms`, `students`, `payments`, `monthly_obligations`,
`monthly_snapshots`, `profiles`, `settings`, `report_logs`.
- Coverage columns: `students.{coverage_start, coverage_end, daily_rate, next_due_date,
  billing_anchor_date}` and `payments.{coverage_start_date, coverage_end_date, days_covered,
  month_year}`.
- RLS scopes Managers to their property. SQL functions/views exist from earlier sprints
  (`get_dashboard_kpis`, `student_coverage_status`, `generate_monthly_obligations`,
  `save_monthly_snapshot`, `recalculate_*`). **Note:** the *current* JS dashboard does **not**
  call the `get_dashboard_kpis` RPC — it classifies in JS via `classifyPortfolio` (the RPC is used
  only by the orphaned legacy `coverageService.js`).

### Cache architecture
- Per-student coverage classifications are cached in `coverageCache` to avoid refetching when
  re-entering a property (Phase 4B.9: ~50% query reduction, instant navigation).
- **Invalidation contract:** any payment create/edit/delete must `setCoverageCache(new Map())` +
  bump `coverageCacheTimestamp`, then call `refresh()`. This is wired in `handleRecordPayment`
  (App.jsx) and `handleEditPayment`/`handleDeletePayment` (p3_modals.jsx, Phase 4B.11).

### Refresh architecture
Mutation → service writes to DB → `rebuildStudentCoverage` recomputes coverage → cache invalidated
→ `refresh()` refetches properties → `buildProps()` re-derives UI rows → components re-fetch
per-student coverage (cache miss) and re-classify. No realtime subscriptions; refresh is explicit.

---

## 3. Source of Truth (authoritative definitions)

| Concept | Authoritative source | Notes / current reality |
|---|---|---|
| **Coverage status** (CURRENT / EXPIRING_SOON / DUE_TODAY / OVERDUE / EXCLUDED) | `statusClassifier.classifyStudent(student)` operating on `students.coverage_end` + `students.status` | Pure function. The ONLY correct status authority. |
| **Coverage period** (`coverage_start`/`coverage_end`/`days_covered`) | `paymentProcessor.processPayment` replayed over full payment history by `rebuildStudentCoverage` | Derived data; payments table is the real source. |
| **Coverage rate (per room)** | `p5_views RoomRow` aggregating `coverageMap` (= classifyStudent results) — covered ÷ occupied | Coverage-based. ✅ |
| **Dashboard KPIs** (Total / Current / Expiring / Overdue / total_overdue_amount) | `coverageDatabaseService.getDashboardKPIs` → `classifyPortfolio` | Coverage-based. ✅ (top KPI strip only) |
| **Room status / financial metrics** | `students.coverage_end` for status; room `expected = beds×rent`, `collected = Σ paid` for money | Status = coverage; money = month-based (labelled "Monthly"). |
| **Financial metrics (collected/expected/arrears)** | `buildProps()` in `p2_helpers` — current calendar month via `monthly_obligations`/`payments.month_year` | ⚠️ Month-based. This is a *different clock* from coverage. |
| **"Overdue" student list / Attention table / Finances page / global Students filter** | `buildProps()` legacy `status = paid>=rent ? PAID : paid>0 ? PARTIAL : OVERDUE` | ⚠️ **NOT coverage-based.** Conflicts with the coverage Overdue KPI. See §5. |
| **Daily rate** | `monthly_rent / 30`, rounded to 2dp | Must match DB. Single definition in `rentCycleCalculator.calculateDailyRate`. |

**The golden rule:** *operational* truth (who is covered / overdue / expiring) comes from
**`coverage_end` via `statusClassifier`**. *Cash* truth (how much came in this month) comes from
month aggregation. These are two legitimate but DIFFERENT measures and must be labelled as such —
they are NOT interchangeable, and mixing them is the root cause of the project's biggest risk.

---

## 4. Completed Work (Sprint 5.5 + Phase 4 → 4B.11)

- **Phase 1 — DB schema + backfill.** Added billing columns; backfilled all historical payments &
  students; 126/126 validation pass after fixing a Postgres integer-rounding bug (round before int cast).
- **Phase 2 — Coverage calculation engine.** `rentCycleCalculator.js` + `paymentProcessor.js`
  (pure). Early-payment detection + prepaid-day preservation. 37 tests.
- **Phase 3 — Status classification engine.** `statusClassifier.js` (classifyStudent / classifyPortfolio)
  + `coverageDatabaseService.js` (sole DB boundary). 4 business-critical scenarios proven.
- **Phase 4 / 4A — Dashboard KPI integration (read-only).** Top KPI strip uses `getDashboardKPIs`.
  Authorized under a strict "no calculations in React" contract (see §6).
- **Phase 4B sub-phases:**
  - **4B.1** Room metrics use coverage classification (covered/overdue/expiring, coverage rate).
  - **4B.2/4B.3** Payment create/edit/delete each run `rebuildStudentCoverage` — single source of truth.
  - **4B.4** `coverageRepairService` — portfolio-wide rebuild + verify utility.
  - **4B.5/4B.6** `DashboardSkeleton` loading state; removed dashboard flicker.
  - **4B.7** Live refresh after payment (cache invalidate + `refresh()`).
  - **4B.8** Financial UX clarity — room footer labels prefixed "Monthly" + tooltips.
  - **4B.9** Coverage cache (`coverageCache` Map) — ~50% fewer queries, instant property switching.
  - **4B.10** Reliability lockdown — BC-8 coverage-cache test suite (13 tests).
  - **4B.11** *(implemented, uncommitted)* Edit/delete cache invalidation in StudentProfile + BC-9 (2 tests).
- **Test suite:** documented at **143/143** passing across 8 files (rentCycleCalculator 23,
  paymentProcessor 23, statusClassifier 19, coverageCache 13+2, plus component/integration tests).
  *(Run `npm test` to confirm against current working tree before relying on this number.)*

---

## 5. Known Problems (unresolved)

> Full detail + severity + suggested fix in `technical-debt-register.md`. Summary here:

1. **Dual coverage engines (HIGH).** `coverageService.js` (legacy) still exists with **different
   math** (`Math.floor` not `Math.round`, no early-payment logic, `coverage_start = payment_date`
   always, wrong column names `date`/`method`, status threshold `>7` returns "PAID"). It is **not
   imported by any UI** today, but it is a live trap: anyone wiring it in reintroduces the
   prepaid-day-loss bug Phase 2 fixed. Should be deleted or quarantined.

2. **Two clocks in the UI (HIGH).** The Dashboard's **Overdue KPI** (coverage-based) and its
   **Attention Required table / property "Alerts"/"Arrears"** (month-based `buildProps` status) can
   and will disagree. PropertyDetail's top "Rate"/"Collected" stats and the global **Students list
   filter (PAID/PARTIAL/OVERDUE)** are all still legacy payment-status. The exact "two versions of
   truth" the Phase 4 authorization warned about — partially realized.

3. **Finances/Arrears page not migrated (HIGH).** `p7_arrears.jsx` has **zero** coverage imports.
   It still buckets by *days since last payment* (0–30/31–60/60+) and computes status from
   `balance = rent − paid`. Sprint 5.5 plan called for coverage-status filters; never done.

4. **Calendar not migrated (MEDIUM).** `p8_calendar.jsx` has no coverage imports.

5. **Payment edit/delete refresh path (MEDIUM).** Coverage rebuild on edit/delete happens inside
   `updatePayment`/`deletePayment` and is best-effort (`try/catch`, "don't fail the update"). A
   silent rebuild failure leaves coverage stale with no user signal. Cache invalidation in the
   profile modal is Phase 4B.11 — **currently uncommitted**.

6. **Coverage recalculation timing / N+1 fetch (MEDIUM).** PropertyDetail fetches coverage
   per-student (`getStudentCoverageData` in a `Promise.all`) rather than one batched query; cold
   load is O(students). `getDashboardKPIs` and per-student fetches are independent round-trips.

7. **Cache invalidation is coarse (LOW/MEDIUM).** Invalidation nukes the **entire** Map on any
   mutation; fine for 4 small properties, wasteful at scale. Relies on every future mutation
   remembering to invalidate (no enforced contract).

8. **Loading-state flicker / hydration (LOW).** Mitigated by `DashboardSkeleton` and per-row
   "Loading…", but PropertyDetail still shows month-based stats instantly while coverage hydrates,
   so the top strip and the room rows can momentarily tell different stories.

9. **Doc/code drift (LOW).** `.kiro/.../CRITICAL_BUSINESS_RULES.md` says use `CHECKED_OUT` and
   "don't use VACATED"; the code filters `status != 'VACATED'` and treats non-ACTIVE as EXCLUDED.
   Status vocabulary is not pinned down in one place.

10. **No-coverage students classified OVERDUE (LOW).** `classifyStudent` returns OVERDUE for an
    ACTIVE student with `coverage_end = null` ("No coverage recorded"). Correct for billing, but
    means a brand-new student with no payment yet shows as Overdue.

---

## 6. Engineering Principles (non-negotiable)

These are inherited from the Phase 4 authorization and the `.kiro` critical rules. **Treat them as
law.** Violating them is the documented way this system breaks.

1. **`coverage_end` is the single billing truth.** All operational status derives from it, never
   from calendar months, `month_year`, or "the 1st."
2. **One source of truth per concept.** No duplicate business logic. `statusClassifier` is the only
   status authority; `rentCycleCalculator` is the only daily-rate/coverage-days authority.
3. **The coverage engine is authoritative + untouchable infrastructure.** Pure services
   (`rentCycleCalculator`, `paymentProcessor`, `statusClassifier`) are locked down by tests.
4. **No business calculations in React components.** Components READ and DISPLAY pre-computed
   values. No date math, no status determination, no `Math.round(amount/daily_rate)`, no
   `coverage_end < today` in `.jsx`. (Display-only formatting is fine.)
5. **Deterministic calculations.** Same payment history ⇒ same coverage, always. Order-independent
   for same-date payments. Proven by BC-8.8.
6. **Idempotent payment processing via full rebuild.** Never patch coverage incrementally on the
   client; always `rebuildStudentCoverage` from the full ledger after a mutation.
7. **Round, never floor.** `coverageDays = Math.round(amount / dailyRate)`. (Flooring caused the
   "29 days instead of 30" bug. The orphaned `coverageService.js` still floors — do not use it.)
8. **Prepaid days are sacred.** Coverage only ever moves forward. Early payment ⇒ start at
   `coverage_end + 1`. Never reset to `payment_date` when coverage exists.
9. **ACTIVE-only operational metrics.** Filter non-ACTIVE out of KPIs/status (EXCLUDED).
10. **No silent failures.** A coverage rebuild that fails must surface to the user — current
    best-effort `try/catch` that swallows errors violates this and is logged as debt (§5.5).
11. **No hidden state.** Coverage cache must be invalidated on every mutation; the invalidation is
    part of the mutation, not an afterthought.

---

## 7. Reliability Requirements

The system must remain correct and consistent across all of these (BC-8 / BC-9 cover several):

- **Browser refresh (F5):** coverage state re-derives identically from DB. ✅ (state is in DB)
- **Logout / login:** reloading profile + properties reproduces the same coverage. ✅
- **Slow network:** skeletons + per-row loading; no flash of wrong numbers (partially — see §5.8).
- **Duplicate clicks / double submit:** ⚠️ not explicitly guarded — payment buttons can be
  double-fired; rebuild is idempotent on read but a double-insert creates two payments. **Gap.**
- **Payment edit:** `updatePayment` → rebuild → cache invalidate → refresh. ✅ (4B.11 uncommitted)
- **Payment delete:** `deletePayment` → rebuild → cache invalidate → refresh. ✅
- **Coverage rebuild:** deterministic, replays whole ledger. ✅
- **Cache rebuild:** full Map invalidation forces re-fetch. ✅
- **Database reconnect / transient error:** ⚠️ rebuild failures are swallowed; no retry/queue. Gap.

---

## 8. Future Work (prioritized)

### Critical (correctness / trust)
- **Unify the UI on the coverage engine.** Migrate Dashboard Attention table, property
  Alerts/Arrears, global Students filter, and the **Finances/Arrears page** off `buildProps`
  legacy status onto `statusClassifier`/coverage. Kill the two-clocks problem (§5.2, §5.3).
- **Delete or quarantine `coverageService.js`** (§5.1) to remove the wrong-math trap.
- **Surface rebuild failures** instead of swallowing them (§5.5, principle §6.10); add a retry path.
- **Guard against duplicate payment submits** (disable button while in flight / idempotency key).

### Important (performance / robustness)
- Batch per-student coverage fetch into one query (or a single view/RPC) — kill the N+1 (§5.6).
- Reconsider `getDashboardKPIs`: either use the SQL `get_dashboard_kpis` RPC consistently or keep
  JS classification — but pick one and document it.
- Finer-grained cache invalidation (per-student) instead of full-Map nuke (§5.7).
- Pin the status vocabulary (ACTIVE/VACATED/CHECKED_OUT) in one place; fix doc drift (§5.9).

### Nice-to-have (Phase 4C and beyond)
- **Phase 4C:** complete coverage-native Finances + Calendar + Reports.
- **Observability:** structured logging beyond `console.*`; surface query timings already measured.
- **Audit logging:** who edited/deleted which payment and the coverage delta (extends `report_logs`).
- **Container deployment / scaling:** Supabase Pro path documented in README for >500 students.
- **Realtime:** Supabase subscriptions to replace explicit `refresh()`.

---

## How to use this constitution

- Before changing coverage/payment/status logic, re-read §3 and §6. If a change would create a
  second authority for any §3 concept, stop.
- Any `.jsx` edit that introduces date math or status logic violates §6.4 — push it into a service.
- After any change, run `npm test` and keep the suite green; the pure-engine tests are the
  guardrail. Update `sprint5.5-final-state.md` and `technical-debt-register.md` if state changes.
