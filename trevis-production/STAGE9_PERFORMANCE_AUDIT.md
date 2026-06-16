# STAGE 9 — PERFORMANCE AUDIT (findings only)

**Date:** 2026-06-16 · **Read-only. No implementation.**
**Scope:** Coverage read paths only (the engine that Stages 8 + R1/R2 stabilized). Mutation/write
paths are correct and out of scope here.
**Context:** Data is now repaired (`drift = 0`, R2 applied) and there is exactly one writer.
These are *optimization* findings on top of correct data — none is a correctness bug.

**Portfolio scale (measured 2026-06-16):** 134 ACTIVE students, 170 total rows, ~149 with coverage.
At this scale every path below is *acceptable today*; the findings matter for Phase 4C growth, not
for current operation. Severity is forward-looking.

---

## Summary table

| ID | Finding | Where | Sev (today / at 5×) | Status |
|----|---------|-------|--------------------|--------|
| TD-7 | N+1 per-student coverage fetch on cold property load | `p5_views.jsx` PropertyDetail | 🟢 low / 🟡 med | mitigated by cache, cold path remains |
| TD-8 | Coarse cache invalidation (`new Map()`) + unenforced invalidation contract | `App.jsx` + `p3_modals.jsx` (6 sites) | 🟢 low / 🟡 med | fragile, not broken |
| TD-9 (read-side) | Two near-identical portfolio queries on dashboard load | `p4_dashboard.jsx` + `coverageDatabaseService.js` | 🟢 low / 🟢 low | redundant, cheap |
| PERF-3 (new) | PropertyDetail re-fetches per-student data the dashboard already fetched wholesale | `p5_views.jsx` vs `getAllStudentsCoverage` | 🟢 low / 🟡 med | architectural overlap |

---

## TD-7 — N+1 per-student coverage fetch (cold property load)

**Where:** [src/parts/p5_views.jsx:49-63](src/parts/p5_views.jsx#L49-L63)
```js
const coveragePromises = studentsToFetch.map(async (student) => {
  const coverageData = await CoverageDB.getStudentCoverageData(student.id);  // 1 round-trip each
  ...
});
const results = await Promise.all(coveragePromises);
```
**Measured behavior:** On first visit to a property with N students, fires **N parallel
`getStudentCoverageData` queries** (one `select … eq('id', studentId).single()` per student) —
[coverageDatabaseService.js:180-192](src/services/coverageDatabaseService.js#L180-L192).

**Mitigation already in place (Phase 4B.9):** `studentsToFetch = realStudents.filter(s => !coverageCache?.has(s.id))`
([p5_views.jsx:40](src/parts/p5_views.jsx#L40)). Repeat visits hit the cache → 0 queries. So the
N+1 only bites the **cold path** (first visit / after any mutation flushes the cache).

**Cost shape:** `Promise.all` makes them concurrent, so wall-clock ≈ one round-trip's latency, but
it's N queries of DB/connection load. At 134 students across ~several properties the per-property N
is small (tens). At 5× it's a connection-pool and rate-limit concern.

**Severity:** 🟢 today (cache + concurrency hide it) / 🟡 at scale.
**Suggested fix (NOT implemented):** Replace the per-student loop with **one** query per property
(`… in (ids)` or filter `getAllStudentsCoverage` by property). See PERF-3 — the single-query data
already exists elsewhere.

---

## TD-8 — Coarse cache invalidation + unenforced contract

**Where:** every mutation resets the whole cache:
- [src/App.jsx:209-210](src/App.jsx#L209-L210)
- [src/parts/p3_modals.jsx](src/parts/p3_modals.jsx) — **6 sites** (lines ~408, 439, 761, 806, 842) each do:
```js
setCoverageCache(new Map());
setCoverageCacheTimestamp(Date.now());
```
**Two distinct issues:**
1. **Blast radius:** any single payment edit nukes *all* cached students → next property visit
   re-runs the full TD-7 cold path for everyone, not just the touched student.
2. **Unenforced contract (the real risk):** invalidation is hand-copied into 6 call sites. Nothing
   forces a *future* mutation to remember it. A new payment path that forgets the two lines →
   silently stale coverage in the UI (data stays correct in DB; only the cached classification is
   stale). This is a maintainability landmine, not a current bug.

**Severity:** 🟢 today / 🟡 at scale + as code grows.
**Suggested fix (NOT implemented):** (a) per-student invalidation — `cache.delete(studentId)` instead
of `new Map()`; (b) centralize mutate-then-invalidate in **one** helper (e.g. `withCoverageInvalidation(studentId, fn)`)
so the contract can't be forgotten. Pairs naturally with TD-7's per-student fetch.

---

## TD-9 (read-side) — Two near-identical portfolio queries on dashboard load

**Where:** [src/parts/p4_dashboard.jsx:33-36](src/parts/p4_dashboard.jsx#L33-L36)
```js
const [kpis, students] = await Promise.all([
  CoverageDB.getDashboardKPIs(),       // select id,status,coverage_end,coverage_start,daily_rate  neq VACATED
  CoverageDB.getAllStudentsCoverage(), // select id,full_name,status,coverage_*,daily_rate,next_due,rooms(...)  neq VACATED
]);
```
**Observation:** Both query the **same rows** (`students` where `status != VACATED`). `getDashboardKPIs`
([coverageDatabaseService.js:133-172](src/services/coverageDatabaseService.js#L133-L172)) then runs
`classifyPortfolio` + an overdue-amount reduce — **all of which could be computed client-side from
the `getAllStudentsCoverage` result** (it already returns status/coverage_end/daily_rate). The
`dashboardAttention.js` service was in fact built to derive these metrics from
`getAllStudentsCoverage` and is "parity-checked against getDashboardKPIs"
([dashboardAttention.js:31](src/services/dashboardAttention.js#L31)).

**Cost:** one extra full-table round-trip on every dashboard mount. Concurrent (`Promise.all`), so
~free in wall-clock; pure redundancy in DB load.

**Severity:** 🟢 / 🟢 (genuinely minor).
**Suggested fix (NOT implemented):** Drop `getDashboardKPIs()` from the dashboard; derive KPIs from
the single `getAllStudentsCoverage()` payload via `dashboardAttention.js` (already parity-checked).
One query instead of two. Keep the RPC-free path. Low priority.

---

## PERF-3 (new finding, not in register) — PropertyDetail re-fetches what the dashboard already has

**The overlap:** The dashboard loads **every** non-vacated student in ONE query
(`getAllStudentsCoverage`, [coverageDatabaseService.js:202-226](src/services/coverageDatabaseService.js#L202-L226)),
including `rooms(...properties(name))` — enough to slice per-property. Then when the user drills into
a property, PropertyDetail **throws that away** and re-fetches each student individually (TD-7).

**Why it matters:** TD-7's N+1 isn't just unbatched — it's *re-fetching data already in memory one
screen earlier*. The fix for TD-7 and PERF-3 is the same: there should be **one** app-level coverage
fetch (the `getAllStudentsCoverage` result), cached once, and both the dashboard and every
PropertyDetail should read/slice from it. That collapses TD-7 (N→0 queries), TD-8 (invalidate the one
store per student), TD-9 (one query feeds KPIs too), and PERF-3 into a single architectural change.

**Severity:** 🟢 today / 🟡 at scale.
**Suggested fix (NOT implemented):** Lift coverage to a single app-level fetch/store
(`getAllStudentsCoverage` → context or query cache); dashboard + PropertyDetail both consume it;
per-student invalidation on mutation. This is the consolidating fix for all four findings.

---

## Verdict

- **No performance issue is a correctness bug.** Data is correct (drift=0); these are load/latency
  and maintainability concerns.
- **At current scale (134 students) every path is acceptable.** Caching + `Promise.all` concurrency
  keep cold loads tolerable and warm loads instant.
- **The one high-leverage change** (deferred, Phase 4C candidate): a single app-level coverage store
  feeding dashboard + PropertyDetail, with per-student invalidation. It resolves TD-7, TD-8, TD-9
  (read-side), and PERF-3 together.
- **Recommendation:** Do NOT implement now. These belong in Phase 4C, after the stabilization report
  is approved. Logged here as findings per the stabilization plan (Stage 9 = findings only).
