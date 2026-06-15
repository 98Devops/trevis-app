# Stabilization — TD-2: Dashboard Unification (one clock)

**Stage:** 5 of 9 · **Status:** ✅ Complete · **Tests:** 160/160 passing (was 150; +10 new).

---

## Business risk removed

The Dashboard ran **two clocks** on a single screen:

| Region | Source (before) | Definition |
|--------|-----------------|------------|
| KPI strip (Total / Current / Expiring / Overdue) | `getDashboardKPIs` → `classifyPortfolio` | **Coverage** (coverage_end vs today) |
| **Attention Required** table + count | `buildProps` `p.overdue` / `totals.overdue` | **Legacy month** (`paid>=rent?PAID:paid>0?PARTIAL:OVERDUE`) |
| Per-row status badge | `s.status` from `buildProps` | Legacy month |
| Property card **Alerts** count | `p.overdue.length` | Legacy month |

Because the two definitions differ, they **diverge**: a student who prepaid 90 days
but paid `$0` *this calendar month* is **CURRENT** in the KPI strip yet appears as
**OVERDUE** in the Attention table with a full month's "balance." The operator sees
"3 overdue" up top and "7 tenants" in the list on the same page — the exact
"two versions of truth" Rules 1 & 3 forbid, and the #1 trust-eroding bug.

## Solution

Every status region on the Dashboard now reads from the **same coverage engine** the
KPI strip uses (`statusClassifier.classifyStudent`). Cash figures stay, but are
relabelled so they're never mistaken for status.

1. **One coverage fetch, not N+1.** The Dashboard's existing `useEffect` (already
   calling `getDashboardKPIs` on every `[props]` change) now also calls
   `getAllStudentsCoverage()` in the same `Promise.all` — a *single* query that
   returns every non-VACATED student with `status`, `coverage_end`, `daily_rate`, and
   room/property. No per-student round-trips (avoids the TD-7 N+1 trap), no new
   App.jsx state, and it refetches on the same `[props]` dependency so it stays in
   sync with every mutation (which already changes `props`).
2. **Pure, tested transformation.** Extracted the list-building logic into
   `src/services/dashboardAttention.js`:
   - `buildAttentionList(coverageStudents)` → classifies each student and keeps only
     `OVERDUE` / `DUE_TODAY` / `EXPIRING_SOON` (CURRENT and non-ACTIVE/EXCLUDED are
     dropped). Computes **coverage** outstanding = `daysOverdue × daily_rate`.
   - `countAttentionByProperty(rows)` → per-property attention count for the card
     "Alerts" badge.
   These are pure (no DB), so they're unit-tested directly
   (`dashboardAttention.test.js`, 10 tests).
3. **Wired the three legacy regions to coverage:**
   - Attention table rows, the per-row `<Badge>`, the header count chip, and the
     mobile cards now use the coverage classification + coverage outstanding.
   - Property-card **Alerts** uses `countAttentionByProperty` (coverage), not
     `p.overdue.length`.
   - The "Balance" column is renamed **Outstanding** (it now shows coverage
     outstanding, not month cash owed).
4. **Kept cash, clearly labelled as cash.** The bar chart and the property-card
   **Collected (mo)** / **Arrears (mo)** are legitimate *cash-basis* monthly figures
   (per the Sprint 5.5 "separation of concerns": Reports = calendar months,
   Operations = coverage windows). They're left intact but explicitly labelled
   "(mo)" / "Monthly cash basis … separate from coverage status" so no one confuses
   a cash number with a status.
5. **Graceful fallback (no broken demo/tests).** When coverage data isn't available
   (demo mode / not configured / fetch failed), the Attention list falls back to the
   legacy month-based `p.overdue` exactly as before — so demo rendering and existing
   tests are unaffected (mirrors the KPI strip's existing fallback).

## Files changed

- `src/services/dashboardAttention.js` — **new** pure helper (`buildAttentionList`,
  `countAttentionByProperty`, `ATTENTION_STATUSES`).
- `src/services/dashboardAttention.test.js` — **new**, 10 tests.
- `src/parts/p4_dashboard.jsx` — fetch `getAllStudentsCoverage` alongside KPIs;
  derive Attention table / count / badges / per-property Alerts from coverage; relabel
  cash figures as monthly; rename Balance → Outstanding.

## Tests

```
Test Files  11 passed (11)
     Tests  160 passed (160)
```

New `dashboardAttention.test.js` pins the behavior that prevents the bug recurring:
- includes OVERDUE / DUE_TODAY / EXPIRING_SOON;
- **excludes CURRENT** (the prepaid-90-days case — the exact two-clocks trigger);
- excludes non-ACTIVE (CHECKED_OUT/VACATED);
- outstanding = `daysOverdue × daily_rate` (coverage, not month cash);
- per-property counts; status-vocabulary guard.

## What you should see on localhost (verification)

> Run `npm run dev`, open the Dashboard.

1. **The KPI "Overdue" number and the Attention table now agree.** Previously the
   top "Overdue" count (coverage) and the Attention list length (month) could differ;
   now both come from the same engine. The header chip reads **"N tenants"** where N
   matches Overdue + Due Today + Expiring Soon.
2. **A prepaid student no longer appears in Attention.** If someone paid for 90 days,
   they're **Current** in the KPI strip *and absent* from the Attention table — even
   at the start of a new calendar month. (Before: they'd wrongly show as Overdue with
   a month's "balance.")
3. **Attention badges read coverage statuses** — "Overdue", "Due Today",
   "Expiring Soon" (with a "X days overdue / remaining" sub-line) — instead of the old
   "Partial". The amount column is now **Outstanding** = days overdue × daily rate
   (e.g. 4 days late at \$5/day → **-\$20**), not a full month's rent.
4. **Property-card "Alerts"** now counts coverage-attention students for that property
   (matches what you see when you click in). The card's **Collected (mo)** /
   **Arrears (mo)** are unchanged numbers but now explicitly labelled monthly cash.
5. **The bar chart is unchanged** but now carries a "Monthly cash basis … separate
   from coverage status" caption, so it's clear it's cash, not status.
6. **Record/edit/delete a payment** → the Attention list, count, badges, and Alerts
   all update without a refresh (the effect refetches on the `props` change the
   mutation triggers). No F5 required, no stale list.
7. **Demo mode / not configured:** identical to before (legacy fallback) — nothing
   regresses.

## Git checkpoint (recommended)

```
git add src/services/dashboardAttention.js \
        src/services/dashboardAttention.test.js \
        src/parts/p4_dashboard.jsx \
        .claude/technical-debt-register.md \
        STABILIZATION_TD2_DASHBOARD_UNIFICATION.md
git commit -m "TD-2: unify Dashboard on coverage engine (Attention table/badges/alerts), 160/160 passing"
git tag -a stabilization-td2-complete -m "TD-2 complete: dashboard single source of truth, 160/160 passing"
```
