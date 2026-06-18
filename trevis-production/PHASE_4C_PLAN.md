# PHASE 4C — PLAN (ledger-as-truth, auto-reconciliation, explainability)

**Date:** 2026-06-18 · **Status:** ✅ APPROVED 2026-06-18 — starting 4C-A.
**Origin:** Synthesis of the stabilization sprint + team review of the Onenhlanha investigation.
**Prereq:** `STABILIZATION_COMPLETION_REPORT.md` approved ✅.

## Approved sequencing (A/B/C — per team review amendment)

> The mission has shifted from **repairing data** to **making future drift impossible and instantly
> visible if it ever reappears.** Integrity → Trust → Performance. Performance is not an emergency
> (134 students, drift=0); a 40ms-vs-150ms query is irrelevant if the owner doesn't trust the number.

**Phase 4C-A — Integrity (FIRST)**
1. **Mutation audit matrix** — enumerate every coverage-affecting mutation, document rebuild status. _(start here — investigation, not risky code)_
2. **Auto-replay all mutation paths** — close gaps; centralize so it can't be forgotten. Highest-risk gap: **rent_per_bed edit** (blast radius = whole room, silent).
3. ✅ **Drift monitor (DONE 2026-06-18)** — R2 `--report` emits a Coverage Integrity Report
   (checked/drifted/corrupt-ranges/reductions, `STATUS: HEALTHY`), read-only, non-zero exit on any
   problem. Scheduled nightly via `.github/workflows/coverage-integrity.yml` (02:00 UTC +
   manual dispatch). **Operator: add repo secrets `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`.**
4. ✅ **Coverage invariants (DONE 2026-06-18)** — `supabase/R3_coverage_invariants.sql` adds
   `CHECK (coverage_start <= coverage_end)` (with read-only pre-flight; start==end is valid).
   Derived-cache contract documented at the top of `coverageDatabaseService.js`.
   **Operator: run R3 in Supabase SQL editor** (pre-flight must be 0 first; it is, post-repair).

**→ Phase 4C-A (Integrity) COMPLETE** once the operator runs R3 + adds the Action secrets.

**Phase 4C-B — Trust & Explainability**
5. **Chain-aware timeline** (current chain vs previous expired chains).
6. **Coverage bar** per student + **integrity status indicator** in admin UI.

**Phase 4C-C — Performance (LAST)**
7. Single app-level coverage store; TD-7, TD-8, TD-9, PERF-3.

_(The detailed item descriptions below remain valid; the A/B/C grouping above is the authoritative
execution order.)_

---

## Guiding principle

> **The payment ledger is the only truth. Everything else is derived cache.**

`coverage_start`, `coverage_end`, `next_due_date`, `daily_rate`, `days_remaining` are **caches** of a
pure function of (`payments` + `room rent` + engine rules). They must never be hand-authored truth.
Two bugs this sprint (FLOOR rounding, last-slice `coverage_start`) and the silent re-drift between R2
runs all share one root: **stored coverage was treated as truth and allowed to diverge from the
ledger.** Phase 4C removes that whole bug class.

The order matters: **prevent drift → detect drift → explain → optimize.** A monitor only finds drift
after it happens; auto-replay makes it structurally impossible. Build prevention first.

---

## Prioritized backlog

### 1. Auto-replay on EVERY mutation (prevent) — _highest priority_

**Goal:** any change to the inputs of coverage triggers `rebuildStudentCoverage` automatically. No
human ever runs a repair script for routine edits.

**What already exists (verified 2026-06-18):**
- ✅ create — `recordPaymentWithCoverage` rebuilds.
- ✅ update payment — `updatePayment` → `rebuildCoverageSafely` (1 retry, surfaces error / TD-5).
- ✅ delete payment — `deletePayment` → `rebuildCoverageSafely`.

**The GAP to close:**
- ❓ **Room change / transfer** (`transferService.executeTransfer`) — verify it rebuilds the moved
  student's coverage (new room = new rent = new daily rate = different day counts).
- ❓ **Room rent edit** (`rent_per_bed` changed on a room) — this changes `daily_rate` for **every
  ACTIVE student in that room**, but currently likely rebuilds **none**. Must fan-out a rebuild to
  all affected students.
- ❓ **Payment date move** — covered by `updatePayment` if date is an editable field; confirm.

**Design:** centralize the contract so it cannot be forgotten (this is also TD-8). One helper:
`withCoverageRebuild(studentId(s), mutationFn)` that runs the mutation then rebuilds + invalidates
cache. Every mutation path routes through it. Rule: **no `students`/`payments`/`rooms` write that
affects coverage may bypass this helper.**

**Tests:** edit/delete/move/room-change/rate-change each assert a rebuild fired and stored == derived.

---

### 2. Make the derived-cache model explicit (eliminate the bug class)

**Goal:** codify that coverage columns are cache, not truth.

- Document the contract at the top of `coverageDatabaseService.js` and in schema comments.
- Optionally add a generated/checked column or a DB CHECK (`coverage_start <= coverage_end`) so the
  exact corruption we just fixed can never be stored again (defense in depth).
- Single derivation path: `rebuildStudentCoverage` (writer) and `coverageBreakdown`/R2 (readers) all
  call the SAME engine — already true; keep it enforced (Rule 1/Rule 2: no duplicate math).

---

### 3. Standing drift monitor (detect) — R2 demoted from fixer to auditor

**Goal:** the system tells YOU when stored cache ≠ derived truth, instead of a human noticing on a
card at 11 PM.

- Keep R2 — but its role is now **verification/audit**, not repair (repair becomes unnecessary once
  #1 holds; the monitor is the safety net for any cache-invalidation gap that slips past #1).
- Schedule R2 `--dry-run` (read-only) on a cadence; alarm if `Drifted > 0` or `coverage_start >=
  coverage_end` (the `supabase/AUDIT_coverage_start_bug.sql` check).
- Surface a tiny "coverage integrity: ✅ in sync / ⚠️ N drifted" indicator in the admin UI.

> Why keep R2 at all in a derived world? Cache invalidation is hard; a future bug *will* slip a stale
> write through. The auditor is belt-and-suspenders on money. Don't delete the safety net.

---

### 4. Chain-aware coverage timeline UI (explain)

**The real lesson of the Onenhlanha episode:** the math was right; the UI never showed the reasoning,
so a human (correctly) distrusted it. Fix the *representation*, not the engine.

**Separate by CHAIN, not by year.** The engine already knows where a chain breaks (a non-early
payment after a lapse). Render each unbroken chain as its own block:

```
Previous coverage (expired)
  30 Jul 2025  $106 + $4 → covered to ~28 Aug 2025   [lapsed]

Current coverage chain
  25 May 2026  $110  → 30d
  02 Jun 2026  $114  → +31d  (early, stacked)
  ─────────────────────────────
  Ends 24 Jul 2026 · 36 days remaining
```

This directly answers "why is a 2025 payment affecting a 2026 student?" → **it isn't; that's a prior,
expired chain.** `coverageBreakdown` already computes `isEarlyPayment` per step and the chain start;
extend it to **group steps into chains** (new chain whenever `isEarlyPayment === false`). Display-only;
no engine change. (Note: the team mockup put all payments in one "current chain" — correct refinement
is to split at the gap, since Onenhlanha's current chain starts 25 May 2026, not 2025.)

Pairs with: a thin coverage **bar/battery** per student (paid-through green, overdue red).

---

### 5. Single app-level coverage store + query/perf (optimize) — _last_

The Stage 9 findings (TD-7 N+1 cold fetch, TD-8 coarse invalidation, TD-9 read-side duplicate query,
PERF-3 PropertyDetail re-fetch). One consolidating change: a single app-level coverage fetch
(`getAllStudentsCoverage`) feeding dashboard + every PropertyDetail, with **per-student** cache
invalidation (delete the touched id, not `new Map()`). Resolves all four together. Do this LAST —
optimization on top of correct, explained, self-reconciling data.

---

## Sequencing rationale

| Order | Item | Type | Why here |
|---|---|---|---|
| 1 | Auto-replay all mutations | prevent | kills drift at the source; ~80% already built, close room/rate/transfer gap |
| 2 | Derived-cache model explicit | prevent | eliminates the bug class; cheap, codifies #1 |
| 3 | Drift monitor (R2 as auditor) | detect | safety net for cache-invalidation gaps; keeps R2, changes its job |
| 4 | Chain-aware timeline UI | explain | the actual fix for "this looks wrong"; reuses fixed engine |
| 5 | App-level store + perf | optimize | last — on top of correct/explained/self-healing data |

## Explicitly NOT in 4C (separate concerns)
- TD-10–13 (legacy `monthly_obligations` cash-basis cleanup, product decisions) — own track.
- Bigger product features (tenant portal, payment gateway, analytics) — see future `PRODUCT_ROADMAP.md`.

## Definition of done for 4C
- Editing/deleting/moving a payment, changing a room or its rent → coverage self-corrects, no script.
- Drift monitor green; `coverage_start >= coverage_end` impossible (CHECK or invariant test).
- Student profile shows current chain vs previous expired chains; "this looks wrong" answers itself.
- Stage 9 perf findings resolved by the single coverage store.
