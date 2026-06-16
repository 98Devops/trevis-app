# Stabilization — TD-3: Finances/Arrears migrated to the Coverage engine

**Stage:** 6 of 9 · **Status:** ✅ Complete · **Tests:** 168/168 passing (was 160; +8 new).
**Money page — verified for consistency against the Dashboard and the coverage engine.**

---

## Business risk removed (Rule 8)

The Finances page — the page **literally about money owed** — defined arrears with a
**third, independent clock**, different from both the Dashboard KPI strip and the
(now-unified) Attention table:

| Concept | Finances (before) | Coverage engine (authoritative) |
|---|---|---|
| "Overdue" | `balance = rent − paid_this_month > 0` | `coverage_end < today` |
| Aging | days **since last payment** (0-30 / 31-60 / 60+) | days **past coverage_end** |
| Outstanding | full month's `rent − paid` | `days_overdue × daily_rate` |
| Status badge | `PARTIAL` / `OVERDUE` (month) | `CURRENT` / `EXPIRING_SOON` / `DUE_TODAY` / `OVERDUE` |

A student mid-coverage (e.g. prepaid through next month) who paid `$0` *this calendar
month* showed a **full month's "balance"** and landed in an aging bucket — even though
they owe **nothing** by coverage. Three contradictory money numbers across three
screens. On a money page that's the most dangerous instance of the two-clocks problem.

## Future-state business rules (defined & enforced)

1. **Source of truth:** status, outstanding, and days derive from the coverage engine
   (`getAllStudentsCoverage` → `classifyStudent`), never `rent − paid`.
2. **Status vocabulary:** `CURRENT / EXPIRING_SOON / DUE_TODAY / OVERDUE`, identical to
   the Dashboard (Rule 3 — one status system). Non-ACTIVE students are excluded.
3. **Filters:** coverage-status chips (**All / Current / Expiring Soon / Due Today /
   Overdue**) replace the aging buckets.
4. **Sort:** default **`coverage_end` ascending** (soonest-to-expire first); a student
   with no coverage (`coverage_end = null`) sorts first as most urgent.
5. **Outstanding:** `days_overdue × daily_rate`, rounded to cents — the *same* formula
   as the Dashboard Attention table and `getDashboardKPIs.total_overdue_amount`.
6. **Days column:** days remaining / days overdue from `classifyStudent.displayLabel`,
   not days-since-last-payment.

## Consistency verification (money-page paranoia)

- **One formula, shared in code.** Outstanding is computed by a single exported
  `coverageOutstanding()` in `dashboardAttention.js`, reused by both the Attention
  table and Finances. A test asserts `finances.outstanding === attention.outstanding`
  for the same student — they **cannot** diverge.
- **One status definition.** Both pages call the same `classifyStudent`. A parity test
  asserts the Finances "overdue" count equals `classifyPortfolio(...).overdue` (the
  exact value behind the Dashboard KPI "Overdue"), so the two pages always agree.
- **One vocabulary, pinned.** `FINANCE_STATUS_FILTERS` and `ATTENTION_STATUSES` are
  asserted by tests to guard against silent drift.
- Cash-basis figures (monthly Collected / Due / Collection Rate) are **kept** — they're
  legitimate per the Sprint 5.5 separation of concerns (Reports = calendar months) —
  but explicitly labelled "monthly cash basis", visually separated from the coverage
  status/outstanding columns so they can't be mistaken for what's owed.

## Files changed

- `src/services/dashboardAttention.js` — added `coverageOutstanding`,
  `buildFinanceRecords`, `filterFinanceRecords`, `sortByCoverageEnd`,
  `FINANCE_STATUS_FILTERS`; extracted shared `toCoverageRow` mapper (Attention +
  Finances share it). Module header updated (now "Coverage Views" — TD-2 & TD-3).
- `src/parts/p7_arrears.jsx` — rewritten to fetch coverage once
  (`getAllStudentsCoverage`, refetch on `[props]`), filter/sort by coverage, show
  coverage status + outstanding + days, and relabel cash figures as monthly.
- `src/services/dashboardAttention.test.js` — +8 tests (finance build/filter/sort,
  outstanding parity, Dashboard-KPI parity, vocabulary guards).

## Tests

```
Test Files  11 passed (11)
     Tests  168 passed (168)
```

## What you should see on localhost (verification)

> `npm run dev` → **Finances**.

1. **Filter chips changed** from aging buckets (0–30 / 31–60 / 60+) to coverage
   statuses: **All · Current · Expiring Soon · Due Today · Overdue**. Each chip shows
   a count and (where > 0) the coverage outstanding for that bucket.
2. **Table columns changed:** Student (with `$rent/mo · $rate/day`), Property, Room,
   **Coverage Ends** (date), **Days** (e.g. "12 days remaining" / "5 days overdue"),
   **Outstanding** (= days overdue × daily rate), Status badge. The old "Balance" /
   "Days since payment" columns are gone.
3. **Default sort is soonest-to-expire** (coverage_end ascending). Students with no
   recorded coverage appear at the top as most urgent.
4. **A prepaid student now reads correctly:** Status **Current**, Outstanding **—**,
   even at the start of a new month. (Before: full month "balance" + an aging bucket.)
5. **Numbers match the Dashboard.** The Finances "overdue" count equals the Dashboard
   KPI "Overdue", and a student's Outstanding here equals their Attention-table figure.
6. **Summary strip:** "Outstanding" = total coverage outstanding (days × daily rate);
   "Collected (mo)" / "Collection Rate" are clearly labelled monthly cash basis.
7. **Record / edit / delete a payment** → the list, counts, status, and outstanding all
   update without a refresh (the page refetches coverage on the `props` change the
   mutation triggers). No F5, no stale arrears.
8. **Demo / not configured:** the coverage fetch returns `[]`, so the page shows an
   empty state rather than legacy month data — consistent with the engine being the
   only truth.

## Git checkpoint (recommended)

```
git add src/services/dashboardAttention.js \
        src/services/dashboardAttention.test.js \
        src/parts/p7_arrears.jsx \
        .claude/technical-debt-register.md \
        STABILIZATION_TD3_FINANCES_COVERAGE_MIGRATION.md
git commit -m "TD-3: migrate Finances to coverage engine (status filters, coverage outstanding), 168/168 passing"
git tag -a stabilization-td3-complete -m "TD-3 complete: Finances on coverage, Dashboard parity, 168/168 passing"
```
