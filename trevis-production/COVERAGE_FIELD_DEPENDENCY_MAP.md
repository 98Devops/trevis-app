# COVERAGE FIELD DEPENDENCY MAP

**Date:** 2026-06-16 · **Read-only audit.**
**Question:** Every consumer that *reads* `coverage_start/end`, `daily_rate`, `next_due_date`, `billing_anchor_date`, and how it derives status/finances from them.

---

## Read path (single source)

```
students.{coverage_start,coverage_end,daily_rate,next_due_date}   ← stored columns
        │
        ├─ coverageDatabaseService.getAllStudentsCoverage()  ← SELECT students + rooms
        ├─ coverageDatabaseService.getDashboardKPIs()        ← SELECT students (counts)
        │
        ▼  (App.jsx props → coverageCache)
   statusClassifier.classifyStudent(student)   ← THE ONLY status authority (JS)
   statusClassifier.classifyPortfolio(students)
        │
        ▼ consumed by every view
```

## Consumer table

| Surface | File | Reads | Status source | Finances source |
|---|---|---|---|---|
| Dashboard KPIs | `src/parts/p4_dashboard.jsx`, `src/services/dashboardAttention.js` | coverage_end via classification | `classifyPortfolio` (JS) | `coverageOutstanding` (JS) |
| Students list | `src/parts/p5_views.jsx` | coverage_end, daily_rate | `classifyStudent` (JS) | JS |
| Property view | `src/parts/p5_views.jsx` (PropertyDetail) | per-student coverage (N+1 fetch — TD-7) | `classifyStudent` (JS) | JS |
| Room view | `src/parts/p5_views.jsx` | coverage_end | `classifyStudent` (JS) | JS |
| Student profile | `src/parts/p5_views.jsx` | coverage_start/end, daily_rate, next_due_date | `classifyStudent` (JS) | JS |
| Finances / Arrears | `src/parts/p7_arrears.jsx` | coverage_end, daily_rate | `classifyStudent` + `coverageOutstanding` (JS) | JS |
| Reports | (derived from above views) | — | JS | JS |

## RPC / SQL read paths

| Reader | Status | Used by live app? |
|---|---|---|
| `student_coverage_status` view (#8/#9) | exists in DB if those scripts ran | ❌ only `_archive/coverageService.legacy.js` (unimported) |
| `get_dashboard_kpis()` RPC (#8) | exists if script ran | ❌ only archived legacy |
| `get_student_status()` / `get_days_status()` | exist if script ran | ❌ unreferenced |

## Findings

1. **Read side is clean and single-source.** Every live surface classifies through the JS `statusClassifier`; none reads the SQL view or RPC. No status vocabulary drift reaches the UI (`get_student_status` returns `'PAID'` — never consumed).
2. **All consumers depend on the stored columns being correct.** They do **not** recompute coverage from the ledger at read time (no rebuild-on-read invariant). So if any latent SQL writer corrupts the stored columns, *every* surface shows the same wrong value consistently (agreement ≠ correctness — the Rutendo lesson).
3. **`billing_anchor_date` is read nowhere in live code** but is *written* by `populate_rent_cycle_fields` (#4/#5/#6). It is a write-only orphan column today.
4. **TD-7 (N+1):** PropertyDetail reads coverage per-student rather than from the batched cache — performance only, not correctness.
