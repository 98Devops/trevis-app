# Trevis — Architecture Summary

Companion to `project-constitution.md`. Built 2026-06-15 from source. Focus: the *map* — how data
moves, who owns truth, where the boundaries are.

---

## System map

```
┌─────────────────────────────────────────────────────────────────────────┐
│  React 19 (Vite)                                                          │
│                                                                           │
│  App.jsx (AppInner)                                                       │
│   ├─ owns: view/nav, modals, coverageCache Map, coverageCacheTimestamp    │
│   ├─ AuthProvider ── user{role, property_id}  (email allowlist gate)      │
│   └─ DataProvider ── properties[] (raw), refresh()                        │
│                                                                           │
│   Views (parts/)                                                          │
│   ├─ p4 Dashboard      KPI strip ─────────────► getDashboardKPIs (coverage)│
│   │                    cards/chart/Attn table ─► buildProps (MONTH) ⚠️     │
│   ├─ p5 PropertyDetail top stats ─────────────► buildProps (MONTH) ⚠️     │
│   │     RoomRow coverage/rate ────────────────► coverageMap=classifyStudent│
│   │     RoomRow $ footer ─────────────────────► beds×rent / Σpaid (MONTH)  │
│   │   Students list (global) ─────────────────► buildProps status ⚠️      │
│   ├─ p7 Finances/Arrears ─────────────────────► buildProps + aging ⚠️ legacy│
│   ├─ p8 Calendar ─────────────────────────────► buildProps ⚠️ legacy      │
│   ├─ p6 Reports, p9 Settings                                              │
│   └─ p3 Modals: PaymentModal, StudentProfile(edit/delete payments)        │
└───────────────┬─────────────────────────────────────────┬───────────────┘
                │ reads                                     │ mutations
                ▼                                           ▼
   ┌───────────────────────────┐         ┌──────────────────────────────────┐
   │ COVERAGE ENGINE (truth)   │         │ paymentService / coverageDatabase  │
   │ rentCycleCalculator (pure)│◄────────│ recordPaymentWithCoverage          │
   │ paymentProcessor (pure)   │ replay  │ updatePayment → rebuild            │
   │ statusClassifier (pure)   │         │ deletePayment → rebuild            │
   │ coverageDatabaseService   │────────►│ rebuildStudentCoverage (replay all)│
   │ coverageRepairService     │         └──────────────────┬─────────────────┘
   │ ✖ coverageService (LEGACY,│                            │
   │   orphaned, wrong math)   │                            ▼
   └───────────────────────────┘                ┌────────────────────────┐
                                                 │ Supabase / PostgreSQL  │
                                                 │ properties, rooms,     │
                                                 │ students(+coverage),   │
                                                 │ payments(+coverage),   │
                                                 │ monthly_obligations,   │
                                                 │ snapshots, profiles    │
                                                 │ RLS + SQL fns/views    │
                                                 └────────────────────────┘
```

⚠️ = a place where the UI reads **month-based** truth instead of coverage truth (two-clocks risk).

---

## The two data lineages (critical to understand)

### Lineage A — Coverage (operational truth)
`payments table` → `rebuildStudentCoverage` replays `processPayment` → writes
`students.coverage_*` → `getStudentCoverageData` / `getDashboardKPIs` →
`classifyStudent` / `classifyPortfolio` → `{CURRENT, EXPIRING_SOON, DUE_TODAY, OVERDUE, EXCLUDED}`
+ days remaining/overdue + total overdue amount.

Used by: Dashboard **top KPI strip**, RoomRow **coverage counts + coverage rate**, per-student
coverage label/badge in the room expansion.

### Lineage B — Month aggregation (cash truth, legacy operational truth)
`getProperties()` (raw rows incl. `monthly_obligations` + `payments`) → **`buildProps()`** →
per current calendar month: `paid` (from this-month obligation/payments), `expected = Σ rent`,
`collected = Σ paid`, and **legacy status** `paid>=rent?PAID:paid>0?PARTIAL:OVERDUE`, plus an
`overdue[]` list.

Used by: Dashboard **cards/chart/Attention table/Alerts/Arrears**, PropertyDetail **top stats**,
RoomRow **$ footer**, global **Students list + filter**, **Finances/Arrears**, **Calendar**, CSV/PDF.

> Both lineages are valid measures of different things (coverage status vs this-month cash). The bug
> is showing them side-by-side as if they answer the same question ("who is overdue?"). See debt #2/#3.

---

## Module responsibilities

| Module | Pure? | Touches DB? | Responsibility |
|---|---|---|---|
| `rentCycleCalculator.js` | ✅ | ✗ | daily rate, coverage days (round), period, next due date, format |
| `paymentProcessor.js` | ✅ | ✗ | `processPayment` (early-payment + prepaid preservation), preview |
| `statusClassifier.js` | ✅ | ✗ | `classifyStudent`, `classifyPortfolio`, badge config |
| `coverageDatabaseService.js` | ✗ | ✅ (only one) | record payment, **rebuildStudentCoverage**, KPIs, fetch coverage |
| `coverageRepairService.js` | ✗ | ✅ | rebuild-all / verify-against-ledger utility |
| `coverageService.js` | ✗ | ✅ | **LEGACY / ORPHANED** — wrong math, do not use (delete candidate) |
| `paymentService.js` | ✗ | ✅ | recordPayment, **updatePayment/deletePayment (→ rebuild)**, fields |
| `propertyService / studentService / authService / reportService` | ✗ | ✅ | CRUD + auth + reporting |
| `p2_helpers.buildProps` | ✗ | ✗ | month-based UI transform (Lineage B) |

---

## Control flow: record a payment (happy path)
1. `PaymentModal` collects amount/date/method (shows live preview via processPayment math).
2. `App.handleRecordPayment` → `coverageDatabaseService.recordPaymentWithCoverage`.
3. Insert into `payments` (coverage cols left null) → `rebuildStudentCoverage(studentId)`.
4. Rebuild loads ALL payments asc, replays `processPayment`, writes coverage on each payment row
   and final coverage on the student.
5. App invalidates cache (`new Map()` + timestamp) → `refresh()` refetches properties.
6. Dashboard refetches KPIs; PropertyDetail refetches coverage on cache miss + re-classifies.

## Control flow: edit/delete a payment
`StudentProfile` inline edit/delete → `updatePayment`/`deletePayment` (paymentService) → internal
`rebuildStudentCoverage` (best-effort try/catch) → handler invalidates cache + `refresh()`
(Phase 4B.11, uncommitted). Risk: swallowed rebuild error ⇒ stale coverage, no user signal.

---

## Boundaries & invariants
- **Only** `coverageDatabaseService` (and `coverageRepairService`, `paymentService` via dynamic
  import) write coverage. Pure engines never touch the network.
- React `.jsx` must not calculate status/coverage/dates — read pre-computed values only.
- Coverage is always re-derived from the full ledger; never patched incrementally on the client.
- Cache invalidation is part of every mutation.

## Known structural weaknesses (see technical-debt-register.md)
- Orphaned wrong-math engine (`coverageService.js`).
- Month-based Lineage B still drives most operational UI surfaces.
- N+1 per-student coverage fetch in PropertyDetail.
- Best-effort (swallowed) rebuild errors; no duplicate-submit guard; coarse cache invalidation.
