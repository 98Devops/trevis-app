# DATA TRUTH AUDIT — STAGE 8.1

**Date:** 2026-06-16
**Auditor mode:** Read-only. No data modified. No migrations run.
**Objective:** Verify every layer represents the same student state across the path
`Database → Coverage Rebuild → Coverage Cache → Dashboard → Students View → Property View → Student Profile`.

**Method:** Raw payment history reconstructed through the **authoritative JS engine**
(`paymentProcessor.processPayment` replay, exactly as `rebuildStudentCoverage` does),
then compared to the SQL rebuild path, the stored columns, and how each UI layer derives
status. Reconstructions were executed against the real engine code (not by hand).

> ⚠️ **Scope correction:** The committed `supabase/seed_payments.sql` contains only a
> single May-2026 payment per student. **Production contains additional historical data**
> (confirmed via the live Rutendo profile: payments in Jan 2025, May 2026, Jun 2026). This
> audit uses the **production** ledger where known (Rutendo) and flags that seed-only
> reconstructions are not representative of production for any student with history.

---

## Architecture recap — where "truth" can diverge

`coverage_start / coverage_end / daily_rate / next_due_date` are **stored columns** on
`students`, not computed at read time. They are written by **two different rebuild
implementations**:

| Path | File | coverage_days formula | Order |
|---|---|---|---|
| **JS engine (authoritative)** | `rentCycleCalculator.js:48` | `Math.round(amount / dailyRate)` | `payment_date ASC` |
| **SQL function** | `rebuild_student_coverage_from_payments` (`phase4b3_repair_stale_coverage.sql:75`) | `FLOOR(amount / dailyRate)` | `payment_date ASC` |

UI layers (Dashboard, Students, Finances, Property/Room) then read the **stored** columns
via `getAllStudentsCoverage()` / `getDashboardKPIs()` and classify with `classifyStudent`.
So a stored column written by the SQL path, or written by a stale rebuild, will be
**faithfully displayed as wrong** by every UI layer simultaneously (they agree with each
other but not with the ledger).

---

## FINDING 1 🔴 CRITICAL — `FLOOR` vs `ROUND` divergence between SQL and JS rebuild (TD-9, real & widespread)

The two rebuild implementations compute **different coverage days** for any payment whose
amount ÷ daily_rate is not an integer. Verified against the engine:

| Student / case | rent | amount | daily_rate | JS `round` | SQL `floor` | Divergence |
|---|---|---|---|---|---|---|
| Onenhlanha (KF R9 partial) | $110 | $106 | 3.67 | **29 d** | 28 d | **−1 day** |
| Any $110 full payment (KF R1/10/18) | $110 | $110 | 3.67 | **30 d** | 29 d | **−1 day** |
| Any $260 full payment (Chase R1, Madden Abel) | $260 | $260 | 8.67 | **30 d** | 29 d | **−1 day** |
| $130 / $120 / $100 / $150 / $300 / $160 | — | full | even-ish | 30 d | 30 d | none |

**Impact:** Every student whose monthly rent does not divide evenly into 30 (notably **all
$110 and $260 rooms** — a large share of King Fisher and several Madden/Chase rooms) loses
**1 day of coverage per payment** whenever the SQL `rebuild_student_coverage_from_payments`
function is the one that wrote their stored `coverage_end`. Over N payments this compounds
to an **N-day understatement** of coverage → premature EXPIRING_SOON/OVERDUE → incorrect
"days remaining" and inflated outstanding.

**This is the same wrong-math class TD-1 archived in `coverageService.js`, still live in SQL.**
Whether a given student is affected depends on which rebuild last touched their row —
which is itself nondeterministic and undocumented (see Finding 4).

**Severity:** CRITICAL (silent, money-affecting, portfolio-wide, source-of-truth split).

---

## FINDING 2 🟠 HIGH — Rutendo Hlabati: stored/displayed status was wrong vs. ledger; engine is right

**Raw production payment history (from live profile):**

| Period | Amount | payment_date | recorded |
|---|---|---|---|
| January 2025 | $120 | 2025-01-15 | historical backfill |
| May 2026 | $120 | 2026-05-25 | — |
| June 2026 | $120 | 2026-06-15 | most recent |

**Authoritative reconstruction (JS engine, `payment_date ASC`, rent $120 → $4.00/day):**

| Step | Payment | Days | Coverage start | Coverage end | Early? | Prepaid preserved |
|---|---|---|---|---|---|---|
| 1 | 2025-01-15 $120 | 30 | 2025-01-15 | 2025-02-13 | no | 0 |
| 2 | 2026-05-25 $120 | 30 | 2026-05-25 | 2026-06-23 | no | 0 |
| 3 | 2026-06-15 $120 | 30 | **2026-06-24** | **2026-07-23** | **yes** | **8 days** |

**Correct final state:** `coverage_end = 2026-07-23` → **CURRENT, 37 days remaining**,
outstanding **$0**. The June 15 payment is correctly detected as **early** and preserves
the 8 prepaid days (Jun 15→23). ✅ Prepaid preservation works and is exercised here.

**What the UI showed:** "Paid / Balance $0" (correct), but an earlier reading showed
**"7 days remaining"** — which matches **none** of the valid reconstructions:

| Reconstruction scenario | coverage_end | days remaining @ 2026-06-16 |
|---|---|---|
| ✅ Correct (3 payments, date order) | 2026-07-23 | **37** |
| created_at order (Jan entered last) | 2026-08-22 | 67 |
| 2026 payments only | 2026-07-23 | 37 |
| SQL `populate_rent_cycle_fields` (**most-recent payment only**) | 2026-07-14 | 28 |

→ "7 days remaining" is not reproducible from the ledger by any path. It is a **stale
render / stale stored value** from before the latest rebuild (Findings 3 & 4), not an
engine error. Today the profile correctly reads Paid/$0 — consistent with a value that
was stale and has since been corrected by a rebuild.

**Severity:** HIGH (operator saw a wrong "days remaining"; root cause is staleness, and the
discrepancy between the three reconstruction methods is itself a source-of-truth problem).

---

## FINDING 3 🟠 HIGH — `populate_rent_cycle_fields` uses ONLY the most-recent payment (drops history)

`sprint5.5_rent_cycle_schema.sql:289-377` — the **initial backfill** function sets each
student's coverage from their **single most recent payment** (`ORDER BY payment_date DESC
LIMIT 1`), ignoring all prior payments and all prepaid-day carry-over.

For Rutendo that yields `coverage_end = 2026-07-14` (28 days) instead of the correct
**2026-07-23** (37 days) — a **9-day understatement** caused by discarding the preserved
prepaid days from earlier payments. Any student whose true coverage depends on
accumulated/early payments is mis-stated until a *full* `rebuildStudentCoverage` (JS) runs
for them.

**Severity:** HIGH (history-dropping; produces stored values that disagree with the
authoritative replay; affects exactly the historical-data students the user flagged).

---

## FINDING 4 🟠 HIGH — Stored coverage columns can be stale; no enforced rebuild-on-read (TD-8)

Coverage columns are written only when a rebuild runs (payment create/edit/delete via JS,
or a manual SQL repair). There is **no invariant** that the stored value reflects the
current ledger:

- The **JS rebuild** (correct, full replay) runs on mutations through the app.
- The **SQL backfill/repair** (Findings 1 & 3) may have written different values historically.
- The in-app **coverage cache** (`coverageCache` Map in `App.jsx`) is invalidated wholesale
  on mutation (`setCoverageCache(new Map())`) — correct but coarse (TD-8). It cannot fix a
  stored column that was already wrong; it only re-fetches whatever is stored.

So a student's row can carry a value written months ago by a now-superseded formula, and
**every UI layer will agree on that wrong value** (cache → dashboard → students → property
→ profile all read the same stored column). Cross-layer *agreement* is not *correctness*.

**Severity:** HIGH (the audit's core question — "does every layer represent the same
state?" — answer: layers agree with each other, but not always with the ledger).

---

## FINDING 5 🟡 MEDIUM — New/ACTIVE student with no payment classifies OVERDUE (TD-11)

`statusClassifier.js:63-71` — ACTIVE + `coverage_end = null` ⇒ OVERDUE "No coverage
recorded". Confirmed for Madden "Dean" and any intake before first payment. Not a data
error, but it inflates the overdue count and misrepresents fresh intake. Product decision.

**Severity:** MEDIUM (correctness-of-meaning; portfolio metric inflation).

---

## Checklist of audited failure modes

| Failure mode | Found? | Where |
|---|---|---|
| Stale cache | Possible (coarse, not corrupting) | App `coverageCache` (TD-8) — re-fetches stored value |
| **Stale coverage fields** | **YES** | Findings 2, 3, 4 — stored columns lag/disagree with ledger |
| Stale UI renders | Indirect | UI faithfully shows stored columns; staleness originates upstream |
| Duplicated payments | None found | Guarded by TD-6 idempotency; no dup rows in sampled data |
| **Missing payments** | **YES (data completeness)** | Seed lacks production history (Rutendo Jan 2025); reconstructions from seed are wrong |
| NaN balances | None found | `Number(...) || 0` guards in `dashboardAttention.toCoverageRow`; daily_rate from rebuild |
| **Incorrect overdue calc** | **YES** | Finding 1 (FLOOR) → premature/incorrect overdue for $110/$260 rooms |
| **Incorrect days-remaining** | **YES** | Findings 1, 2, 3 — off-by-N from FLOOR / most-recent-only / staleness |

---

## Affected students (representative, 10+ traced)

| # | Student | Issue | Correct state | Risk |
|---|---|---|---|---|
| 1 | **Rutendo Hlabati** (Chase R3) | Stale "7 days remaining" vs ledger | CURRENT, 37 d, $0 | HIGH |
| 2 | Onenhlanha (KF R9) | FLOOR loses 1 day on $106 partial | 29 d not 28 | CRITICAL class |
| 3 | All KF $110 rooms (R1×4, R10×4, R18×5, …) | FLOOR loses 1 day/payment | 30 d not 29 | CRITICAL class |
| 4 | Abel (Madden R3, $260) | FLOOR loses 1 day | 30 d not 29 | CRITICAL class |
| 5 | Mr Matenhese (Chase R1, $260) | FLOOR loses 1 day | 30 d not 29 | CRITICAL class |
| 6 | Dean (Madden R1) | No payment ⇒ OVERDUE | NEW/intake, not arrears | MEDIUM |
| 7 | Nerrisa (New House R7) | No payment ⇒ OVERDUE | NEW/intake | MEDIUM |
| 8 | Dorcus (New House R4) | No payment ⇒ OVERDUE | NEW/intake | MEDIUM |
| 9 | Ropafadzo (KF R20, $180/$360) | Partial; FLOOR==ROUND here (15 d) | correct | LOW |
| 10 | Any student with pre-May history | Seed/backfill drops history | needs full JS replay | HIGH |

(All $130/$120/$100/$150/$300/$160 single-payment students reconstruct **correctly** under
both paths and across all layers — these are the majority and are sound.)

---

## Root causes

1. **Two rebuild engines with different math (FLOOR vs ROUND)** — TD-9, never reconciled.
   The SQL `rebuild_student_coverage_from_payments` and `populate_rent_cycle_fields` are
   second/third sources of truth for stored coverage columns.
2. **Backfill drops payment history** (`populate_rent_cycle_fields` = most-recent-only),
   so stored columns never reflected accumulated/prepaid coverage until a full JS rebuild.
3. **Stored columns with no rebuild-on-read invariant** (TD-8) — a wrong stored value is
   shown identically by all layers; agreement masks incorrectness.
4. **Seed vs production drift** — historical payments exist in production but not in seed,
   so any audit/test built on seed under-represents real coverage.

---

## Recommended fixes (audit recommendations only — NOT executed)

| # | Fix | Addresses | Priority |
|---|---|---|---|
| R1 | **Retire the SQL rebuild/backfill functions** (or make them delegate to / match `Math.round`). Make JS `rebuildStudentCoverage` the *only* writer of coverage columns. | Findings 1, 3 (TD-9) | 🔴 P0 |
| R2 | **One-time full JS re-replay for every ACTIVE student** (via existing `rebuildStudentCoverage`, which already orders by `payment_date ASC` and uses `round`) to overwrite any FLOOR/most-recent-only stored values. Verify with a parity report before/after. | Findings 1, 2, 3, 4 | 🔴 P0 |
| R3 | Add a **parity test/health-check**: for a sample of students, assert `stored coverage_end === JS-replay coverage_end`; alert on drift. | Finding 4 | 🟠 P1 |
| R4 | **Per-student cache invalidation** + centralized mutation wrapper so invalidation can't be forgotten. | TD-8 / Finding 4 | 🟠 P1 |
| R5 | Ensure **seed/test fixtures include historical (pre-May) payments** so reconstructions match production. | Finding (missing payments) | 🟠 P1 |
| R6 | Introduce a **NEW/UNCOVERED** state for ACTIVE students with no payment yet (product decision). | Finding 5 (TD-11) | 🟡 P2 |

---

## Verdict

- **The authoritative JS coverage engine is mathematically correct** (Rutendo replays to
  the right CURRENT/37-days/$0 result; prepaid preservation works).
- **The data-truth risk is upstream of the UI:** stored coverage columns can be wrong
  because a *second* (SQL `FLOOR`) and *third* (most-recent-only backfill) engine have
  written them, and there is no enforced rebuild-on-read invariant. When that happens,
  **all UI layers agree on the wrong number** — which is exactly the "two clocks" failure
  class this sprint exists to eliminate, now found at the data layer rather than the view
  layer.
- **No duplicated payments and no NaN balances** were found. The most material, fixable
  issue is **R1 + R2** (retire SQL math, re-replay all students with the JS engine).

This is a **reliability blocker worth resolving before Phase 4C**, but it is a
**data-remediation + dead-SQL-removal** task (R1/R2), not a flaw in the stabilized JS code
paths. Recommend addressing R1/R2 under the existing TD-9 banner before the final
Phase 4C readiness sign-off.
