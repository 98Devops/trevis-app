# RELIABILITY AUDIT — STAGE 8

**Date:** 2026-06-16
**Objective:** Confirm payment create/edit/delete propagate instantly to every view, that
cache invalidation works, and that **all views read the same source of truth**.
**Method:** Code-path trace of the live mutation handlers and the per-view refresh effects.
No data modified.

## Verdict: ✅ PASS — single source of truth, instant propagation on all paths

Every coverage-displaying surface derives status from the **one** authoritative chain:

```
payment mutation
  → JS rebuildStudentCoverage(studentId)        [writes students.coverage_* columns]
  → setCoverageCache(new Map()) + timestamp      [invalidate app cache]
  → refresh()                                    [re-fetch raw data from useData()]
  → props (useMemo) changes
  → each view's useEffect([props]) refetches getAllStudentsCoverage()
  → classifyStudent(...)                         [ONE classifier, everywhere]
```

There is exactly **one** function that writes coverage (`rebuildStudentCoverage`) and
**one** function that classifies status (`classifyStudent`). No view computes its own.

---

## 1. Create payment — ✅

**Path:** `handleRecordPayment` (`App.jsx:193`) → `recordPaymentWithCoverage`
(`coverageDatabaseService.js:41`):
- Inserts payment row (with TD-6 10s duplicate suppression, lines 50–71).
- Calls `rebuildStudentCoverage(studentId)` with one retry (lines 101–110) — **authoritative JS engine**.
- Returns `rebuildError`; handler surfaces a toast on failure (TD-5, `App.jsx:217`).
- Invalidates cache (`setCoverageCache(new Map())`, line 209) + `refresh()` (line 213).

**Result:** payment row + coverage columns written atomically-enough, cache cleared, all
views re-fetch. ✅

## 2. Edit payment — ✅

**Path:** inline edits + modal in `p3_modals.jsx` (lines 401, 755, 800, 836, …) →
`updatePayment` (`paymentService.js:44`):
- Rewrites `month_year` if `payment_date` changed (line 59) — keeps period in sync.
- Whitelisted payload (lines 64–70) — only real columns written.
- Calls `rebuildCoverageSafely → rebuildStudentCoverage` (lines 86, 102–115) — **same engine**.
- Returns `rebuildError`; UI surfaces it; then `setCoverageCache(new Map())` + timestamp
  (e.g. lines 406–409, 760–762, 805–807, 841–843).
- Guarded against double-submit by `InlineEditField.isSaving` (TD-6).

**Result:** edit re-replays the full ledger (not a delta), so coverage is always consistent
with the post-edit ledger. ✅

## 3. Delete payment — ✅

**Path:** `StudentProfile` delete handler (`p3_modals.jsx:432`, in-flight `isDeleting`
guard line 369, TD-6) → `deletePayment` (`paymentService.js:117`):
- Reads `student_id` before delete (line 121), deletes row, then
  `rebuildCoverageSafely → rebuildStudentCoverage` (line 142) — **same engine**.
- If it was the only/last payment, rebuild correctly resets coverage to NULL
  (`coverageDatabaseService.js:274-296`).
- Returns `rebuildError`; UI surfaces it; `setCoverageCache(new Map())` + timestamp (lines 437–440).

**Result:** coverage shrinks/clears correctly; verified by MONTH_BOUNDARY_VERIFICATION #12. ✅

## 4. Cache invalidation — ✅ (works; coarse — TD-8)

- App-level cache: `coverageCache` Map + `coverageCacheTimestamp` (`App.jsx:122-123`).
- **Every** mutation handler calls `setCoverageCache(new Map())` and bumps the timestamp.
- `PropertyDetail` keys its fetch effect on `coverageCache` + `coverageCacheTimestamp`
  (`p5_views.jsx:93`), so clearing the map forces a re-fetch of all visible students.
- ⚠️ **Coarse** (TD-8): clears the entire map on any single change, and correctness depends
  on every future mutation remembering to invalidate (no enforced wrapper). Correct today;
  a robustness item, not a defect.

**Result:** no stale cache after any mutation in the current code paths. ✅

## 5–9. Per-view refresh — all read the same truth

| View | Fetch | Classifier | Refetch trigger | Result |
|---|---|---|---|---|
| **Dashboard** (5) | `getDashboardKPIs` + `getAllStudentsCoverage` | `classifyPortfolio`/`classifyStudent` + `buildAttentionList` | `useEffect([props])` (TD-2) | ✅ |
| **Students** (6) | `getAllStudentsCoverage` | `classifyStudent` → `coverageMap` | `useEffect([props])` (TD-4) | ✅ |
| **Finances** (7) | `getAllStudentsCoverage` | `classifyStudent` + shared `coverageOutstanding` | `useEffect([props])` (TD-3) | ✅ |
| **Property** (8) | per-student coverage via cache | `classifyStudent` | `useEffect([name,prop,coverageCache,timestamp])` | ✅ |
| **Room card** (9) | reads the same coverage rows as Property | `classifyStudent` | same effect as Property | ✅ |

Because `refresh()` rebuilds `props` and **every** view's effect depends on `props` (or on
the cache/timestamp that the mutation also bumped), all five re-fetch and re-classify after
any mutation — **no manual refresh / F5 required**.

---

## Single-source-of-truth confirmation

| Concern | Single source? | Evidence |
|---|---|---|
| Who **writes** coverage | ✅ `rebuildStudentCoverage` (JS) | create/edit/delete all funnel through it (§1–3) |
| Who **classifies** status | ✅ `classifyStudent` | Dashboard/Students/Finances/Property/Room all call it (§5–9) |
| Outstanding formula | ✅ `coverageOutstanding` | shared by Dashboard + Finances (TD-3 parity test) |
| Status vocabulary | ✅ CURRENT/EXPIRING_SOON/DUE_TODAY/OVERDUE | no PAID/PARTIAL/OVERDUE in active views (TD-2/3/4) |
| Tests | ✅ 169/169 | incl. cross-view parity tests in `dashboardAttention.test.js` |

## Known residual risks (not defects in these paths)

1. **TD-8** — coarse cache invalidation + implicit "remember to invalidate" contract.
2. **🔴 Stored-data drift** — the SQL `FLOOR`/most-recent-only engines may have written
   wrong coverage columns historically (DATA_TRUTH_AUDIT Findings 1 & 3). The live mutation
   paths are correct, but **pre-existing stored values are not guaranteed correct** until a
   full JS re-replay runs. → addressed by **R1 + R2** (executed next).

## Verdict

The live create/edit/delete → rebuild → invalidate → refresh → classify chain is **reliable
and single-source**. The only thing standing between "reliable code" and "reliable data" is
the historical drift, which R1 (retire SQL rebuild) and R2 (full portfolio replay) close.
