# Stabilization — TD-4: Students Global List migrated to Coverage engine

**Stage:** 7 of 9 · **Status:** ✅ Complete · **Tests:** 169/169 passing (was 168; +1 new).

---

## Business risk removed (Rule 8)

The **Students** global list (`p5_views.jsx`) was the last UI surface showing legacy
`PAID / PARTIAL / OVERDUE` status (month-based, from `buildProps`). This created a
direct contradiction within a single navigation session:

- Open **PropertyDetail → Room 3 → Student A** → badge reads **"Current"** (coverage)
- Navigate to **Students (global list) → Student A** → badge reads **"Partial"** (month)

Same student, same session, two different statuses — the exact "inconsistent with the
coverage badges shown inside PropertyDetail room rows" problem described in the TD-4
register entry (Rule 3: no duplicate status systems).

## Solution

The `Students` function now follows the exact same pattern as the Dashboard and
Finances pages:

1. **One `getAllStudentsCoverage()` fetch**, called once in a `useEffect` that refetches
   on `[props]` (so it stays live after every payment mutation — no F5).
2. Builds a **`coverageMap: studentId → classifyStudent result`** in memory.
3. **Filter chips** `ALL / PAID / PARTIAL / OVERDUE` → `ALL / Current / Expiring Soon /
   Due Today / Overdue` (coverage vocabulary, colour-coded to match Dashboard badges).
4. **Per-row `<Badge>`** and mobile card badges read `coverageMap.get(s.id)?.status`
   — the same `classifyStudent` result that `PropertyDetail` / `RoomRow` use from the
   shared cache. A student's status is now identical in every view.
5. **While coverage is loading** (initial fetch or after a mutation), active-student
   badges show `…` instead of a stale legacy badge — no mixed-state display.
6. **Cash figures (Rent / Paid)** are unchanged — they're legitimate.

## Files changed

- `src/parts/p5_views.jsx` — `Students` function rewritten (lines 328–end);
  `PropertyDetail` / `RoomRow` untouched (already correct).
- `src/services/dashboardAttention.test.js` — +1 cross-view consistency test (confirms
  that `classifyStudent`, `buildFinanceRecords`, and the Students coverage map all
  produce the same status for the same student).

## Tests

```
Test Files  11 passed (11)
     Tests  169 passed (169)
```

The added test pins the contract: `classifyStudent(s).status === buildFinanceRecords([s])[0].coverageStatus`
— so PropertyDetail, Finances, and Students cannot diverge.

## What you should see on localhost (verification)

> `npm run dev` → **Students**.

1. **Filter chips** now read: **All · Current · Expiring Soon · Due Today · Overdue**
   (with live counts). The old PAID / PARTIAL / OVERDUE chips are gone.
2. **Badges** read coverage statuses — "Current", "Expiring Soon", "Due Today",
   "Overdue" — matching what the same student shows in PropertyDetail and on the
   Dashboard. No more "Partial" badge anywhere in the app.
3. **Cross-view consistency check:** open Students, note Student A's badge. Navigate to
   their property detail room. The badge is **identical**. Navigate to Finances. The
   status filter that contains them is **identical**. One truth everywhere.
4. **Record / edit / delete a payment** → Students list status and counts update
   without F5 (the effect refetches on the `props` change the mutation triggers).
5. **Loading state:** on first load (or right after a mutation before refetch), active
   students show a `…` placeholder — no stale legacy badge flashes.

## Git checkpoint (recommended)

```
git add src/parts/p5_views.jsx \
        src/services/dashboardAttention.test.js \
        .claude/technical-debt-register.md \
        STABILIZATION_TD4_STUDENTS_VIEW_COVERAGE.md
git commit -m "TD-4: migrate Students global list to coverage status (no more PAID/PARTIAL/OVERDUE), 169/169 passing"
git tag -a stabilization-td4-complete -m "TD-4 complete: Students list on coverage, all views unified, 169/169 passing"
```
