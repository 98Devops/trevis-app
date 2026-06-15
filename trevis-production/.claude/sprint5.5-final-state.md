# Sprint 5.5 — Final State

Flexible Rent Cycle Engine. State as of 2026-06-15, branch `sprint5-5-ui-work`, HEAD `536820d`
(+ uncommitted Phase 4B.11). Source of facts: code read + PHASE*/SPRINT* docs + git tags.

---

## Goal (recap)
Replace calendar-month billing with **per-student rolling coverage windows** derived from payment
dates. "Overdue on the 1st" → "overdue when *your* coverage_end passes."

## Phase ledger

| Phase | Status | What shipped | Evidence |
|---|---|---|---|
| 1 — DB schema + backfill | ✅ Done | coverage columns, `populate_rent_cycle_fields`, 126/126 validation (after round-before-int fix) | git `45f7953`; SPRINT_5.5_PROGRESS |
| 2 — Coverage calc engine | ✅ Done | `rentCycleCalculator.js`, `paymentProcessor.js` (early-payment, prepaid preservation) | tag `bc-5-massive-prepayment-complete`; 37 tests |
| 3 — Status classification | ✅ Done | `statusClassifier.js`, `coverageDatabaseService.js` | tag `sprint5-5-phase3-*`; 4 BC scenarios |
| 4 / 4A — Dashboard KPIs | ✅ Done | top KPI strip from `getDashboardKPIs` (read-only) | tag `sprint5-5-phase4a-dashboard-stable` |
| 4B.1 — Room metrics | ✅ Done | RoomRow coverage counts + coverage rate | PHASE4B.1_* |
| 4B.2/4B.3 — Payment CRUD rebuild | ✅ Done | create/edit/delete → `rebuildStudentCoverage` | PHASE4B.2/3 |
| 4B.4 — Repair tool | ✅ Done | `coverageRepairService` rebuild-all + verify | PHASE4B.4 |
| 4B.5/4B.6 — Skeletons/flicker | ✅ Done | `DashboardSkeleton`, flicker fix | tag `...phase4b.5-and-4b.6` |
| 4B.7 — Live refresh | ✅ Done | cache invalidate + refresh after payment | PHASE4B.7 |
| 4B.8 — Financial UX clarity | ✅ Done | "Monthly" labels + tooltips on room footer | PHASE4B.8 |
| 4B.9 — Coverage cache | ✅ Done | `coverageCache` Map, ~50% fewer queries | tag `...phase4b.9-coverage-cache` |
| 4B.10 — Reliability lockdown | ✅ Done | BC-8 suite (13 tests) | tag `sprint5-5-phase4b-reliability-complete` |
| 4B.11 — Edit cache invalidation | ⚠️ Implemented, **uncommitted** | StudentProfile cache invalidation + BC-9 (2 tests) | PHASE4B.11_*; working tree |
| 5 — Arrears/Reports coverage-native | ❌ Not done | Finances/Calendar still legacy month-based | code: p7/p8 have no coverage imports |
| 6 — Property-based testing | ❌ Not done | example/unit tests only; no fast-check PBT | — |

## What is genuinely working (coverage-native)
- Pure engine: daily rate, coverage days (round), early-payment stacking, prepaid preservation.
- Deterministic rebuild from full payment ledger on every create/edit/delete.
- Dashboard **top KPI strip** (Total / Current / Expiring / Overdue / arrears $).
- PropertyDetail **room rows**: covered / overdue / expiring counts + coverage rate + per-student
  coverage label & badge.
- Coverage cache with invalidation on mutation; survives refresh/login (state lives in DB).
- Tests: documented **143/143** passing (rentCycleCalculator 23, paymentProcessor 23,
  statusClassifier 19, coverageCache 15, + components). Re-run `npm test` to confirm current tree.

## What is NOT done / still legacy (the gap to "Sprint 5.5 complete")
- **Finances/Arrears page** (`p7_arrears.jsx`): aging buckets + `balance`-based status. No coverage. ❌
- **Calendar** (`p8_calendar.jsx`): no coverage. ❌
- **Global Students list** (`p5_views Students`): PAID/PARTIAL/OVERDUE month status filter. ❌
- **Dashboard lower half**: property cards, chart, Attention table use `buildProps` month status. ⚠️
- **PropertyDetail top stats** (Collected/Rate): month-based. ⚠️
- **Orphaned `coverageService.js`**: legacy wrong-math engine still in tree. ⚠️
- **Phase 6 PBT** and a coverage-native **Reports/CSV/PDF** export: not started.

## Net assessment
The **engine and the per-student/per-room coverage display are done and trustworthy.** Sprint 5.5
is **NOT fully landed at the UI level**: the operator-facing "who's overdue" surfaces
(Finances, Attention table, global Students, property cards) still run on the **old month-based
clock**, producing visible disagreement with the coverage KPIs. Closing that gap (TD-2/3/4 in the
debt register) is the remaining Sprint 5.5 / Phase 4C–5 work.

## Recovery points (git tags)
`sprint5-5-phase3-tests-complete` · `sprint5-5-phase4a-dashboard-stable` ·
`sprint5-5-phase4b.5-and-4b.6-complete` · `sprint5-5-phase4b.9-coverage-cache-complete` ·
`sprint5-5-phase4b-reliability-complete` (HEAD−1).

## Immediate next actions
1. `npm test` → confirm green → commit + tag Phase 4B.11 (protect uncommitted work).
2. Delete/quarantine `coverageService.js`.
3. Plan Phase 4C: migrate Finances + Attention table + global Students to coverage classification;
   make rebuild failures non-silent; guard duplicate payment submits.
