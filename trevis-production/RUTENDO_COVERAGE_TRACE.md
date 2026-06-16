# RUTENDO COVERAGE TRACE — STAGE 8E

**Student:** Rutendo Hlabati
**Student ID:** `c1000002-0000-0000-0000-000000000005`
**Property:** The Chase · **Room:** Room 3 (`b1000000-0002-0000-0000-000000000003`)
**Status:** ACTIVE
**Trace date (today):** 2026-06-16
**Data modified:** ❌ No — read-only investigation.

> Method: reconstructed deterministically from `supabase/seed.sql`,
> `supabase/seed_payments.sql`, and the authoritative engine
> (`rentCycleCalculator.js` → `paymentProcessor.js` → `statusClassifier.js`).
> No live DB query was run; the engine is pure and fully replayable from seed input,
> so this trace is exactly what `rebuildStudentCoverage` would produce.

---

## 1. Student parameters

| Field | Value | Source / derivation |
|---|---|---|
| **monthly_rent** | **$120.00** | `rooms.rent_per_bed` for Room 3, `seed.sql:120` |
| **daily_rate** | **$4.00 / day** | `round((120 / 30) × 100) / 100` (`rentCycleCalculator.calculateDailyRate`) |
| **coverage_start** | **2026-05-01** | first (only) payment date; normal payment, no prior coverage |
| **coverage_end** | **2026-05-30** | `coverage_start + (coverageDays − 1)` = `2026-05-01 + 29 days` |
| **next_due_date** | **2026-05-31** (anchor day 1 → next anchor) | day after coverage_end via `calculateNextDueDate` |

---

## 2. Payments

Rutendo has exactly **one** payment on record (`seed_payments.sql:99`):

| # | Payment ID | Date | Amount | Daily rate | Calculated coverage days |
|---|---|---|---|---|---|
| 1 | (seed row, `student_id c1000002-…005`, `month_year 2026-05`) | 2026-05-01 | $120.00 | $4.00 | `round(120 / 4.00)` = **30 days** |

> Seed rows do not carry an explicit payment UUID column; identity is
> `(student_id, amount, payment_date, month_year) = (…005, 120, 2026-05-01, 2026-05)`.

---

## 3. Chronological reconstruction (exactly as the engine replays it)

Starting state: `coverage_end = null`.

**Payment 1 — $120 on 2026-05-01**
- `calculateCoverage(120, 120)` → dailyRate $4.00, coverageDays = `round(120/4.00)` = **30**.
- Existing coverage_end is null → **NORMAL payment** (not early; no prepaid days to preserve).
- `coverageStart` = payment_date = **2026-05-01**.
- `coverageEnd` = `coverageStart + (30 − 1)` = 2026-05-01 + 29 days = **2026-05-30** (inclusive-day rule).
- `nextDueDate` = day after coverage_end = **2026-05-31**.

Final state after replay: `coverage_start = 2026-05-01`, `coverage_end = 2026-05-30`.

**Classification today (2026-06-16)** via `classifyStudent`:
- `diff = ceil((2026-05-30 − 2026-06-16) / 1 day)` = **−17**.
- `diff < 0` → **status = OVERDUE**, `daysOverdue = 17`, label **"17 days overdue"**.
- Coverage outstanding = `daysOverdue × daily_rate` = `17 × $4.00` = **$68.00**.

(If "today" were 2026-06-15, diff = −16 → "16 days overdue".)

---

## 4. Answers

### A. Is prepaid preservation working?
**Working — but not exercised in Rutendo's case.** She has only one payment and no
prior coverage, so the early-payment branch in `processPayment` (lines 99–110) never
fires. Prepaid preservation logic is correct and present; it simply has nothing to
preserve here. There is **no bug in preservation** for this student.

### B. Were any prepaid days lost?
**No.** $120 at $4.00/day bought exactly 30 days (2026-05-01 → 2026-05-30), with zero
remainder. Nothing was discarded or truncated (`Math.round`, not `Math.floor`, and the
full amount divided evenly). 100% of paid days are accounted for.

### C. Should coverage_end actually be later than currently displayed?
**No.** $120 ÷ $4.00/day = 30 days is the maximum coverage this single payment can buy.
coverage_end = 2026-05-30 is the correct and complete result. It cannot legitimately be
later **unless an additional payment exists that is missing from the seed** — which is
the real question worth raising operationally (see ⚠️ below).

### D. Is the displayed "7 days remaining" mathematically correct?
**No — this is impossible given the data.** Her coverage ended 2026-05-30, which is
17 days **in the past** relative to today (2026-06-16). The correct engine output is
**OVERDUE, ~17 days overdue, $68.00 outstanding** — not "7 days remaining."

"7 days remaining" is precisely the boundary value of the **EXPIRING_SOON** band
(`diff ≤ 7`), which strongly suggests the "7 days" was **not** produced by the coverage
engine for Rutendo at all. The most likely sources:
1. A **stale UI render** (coverage cache not invalidated, or a view still showing a
   value computed on an earlier date) — relevant to the Stage 8 reliability audit and
   TD-8 (coarse cache invalidation).
2. The number was read from a **different student / row** (mis-attribution).
3. An **unrecorded second payment** exists in reality that would push coverage_end into
   mid-June — in which case the seed/ledger is incomplete, not the engine.

> ⚠️ **Operational flag:** If the operator believes Rutendo paid more than $120 / is
> genuinely current, a payment is missing from the ledger. The engine is faithfully
> reporting OVERDUE from the data it has. Recommended next step: confirm whether a
> June payment exists; if so, record it (engine will recompute to CURRENT). Do **not**
> hand-edit coverage_end — let the deterministic rebuild own it (Rule 1, Rule 5).

---

## Summary

| Question | Answer |
|---|---|
| Prepaid preservation working? | Yes (not exercised — single payment) |
| Prepaid days lost? | No (30 days bought, 30 days granted, exact) |
| coverage_end should be later? | No — $120 buys exactly 30 days (ends 2026-05-30) |
| "7 days remaining" correct? | **No** — engine says **OVERDUE ~17 days, $68 outstanding** |

**Verdict:** The coverage **engine math is correct**. The displayed "7 days remaining"
is a **display/staleness or missing-payment issue**, not an engine error — consistent
with the cache-invalidation concerns tracked in the reliability/performance audit.
