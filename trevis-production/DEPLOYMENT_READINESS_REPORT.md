# DEPLOYMENT_READINESS_REPORT.md

## Trevis Sprint 5.5 Stabilization — Deployment Handover

**Date:** 2026-06-16
**Branch:** `sprint5-5-ui-work`
**Status:** READY FOR DEPLOYMENT (pending Stage 8/9 audit sign-off)
**Tests:** 169 / 169 passing · **Build:** PASS

> Note: Stages 8 (Reliability Audit) and 9 (Performance Audit findings) are the final
> steps of the stabilization sprint and are still to be formally signed off. This report
> reflects the verified state of the code, tests, and build as of the commit below.

---

## Executive Summary

The stabilization sprint replaced multiple conflicting "clocks" (month-based vs
coverage-based status) with a **single coverage-engine source of truth** across the
Dashboard, Finances, and Students views, archived a dead wrong-math engine, eliminated
silent rebuild failures, and added duplicate-payment protection. All work is committed,
tagged, and green on tests and build.

---

## Technical Debt — COMPLETED

| TD | Title | Status | Commit | Tag |
|---|---|---|---|---|
| TD-14 | Commit Phase 4B.11 edit/delete cache invalidation | ✅ | `7513dbd` | — |
| TD-5 | Surface silent coverage rebuild failures | ✅ | `78e2344` | `stabilization-td5-complete` |
| TD-6 | Duplicate payment protection (UI guards + idempotency) | ✅ | `e9bcf10` | `stabilization-td6-complete` |
| TD-1 | Archive orphaned wrong-math coverage engine | ✅ | `2afcb6f` | `stabilization-td1-complete` |
| TD-2 | Unify Dashboard on coverage engine | ✅ | `ce04283` | `stabilization-td2-complete` |
| TD-3 | Migrate Finances/Arrears to coverage engine | ✅ | `83627e5` | `stabilization-td3-complete` |
| TD-4 | Migrate Students global list to coverage status | ✅ | `b1c72a7` | `stabilization-td4-complete` |

Coverage engine is now the **single source of truth** across: Dashboard KPI strip,
Dashboard Attention table, property card alerts, Finances page, Students global list,
and PropertyDetail/RoomRow. No legacy `PAID/PARTIAL/OVERDUE` status badges remain in any
active UI view.

---

## Technical Debt — REMAINING (non-blocking)

| TD | Title | Priority | Type | Blocking? |
|---|---|---|---|---|
| TD-7 | PropertyDetail N+1 coverage fetch | Medium | Performance | No |
| TD-8 | Coarse cache invalidation (`new Map()` on every mutation) | Medium | Performance / robustness | No |
| TD-9 | KPI source consistency (JS classify vs SQL RPC) | Medium | Maintainability | No |
| TD-10 | Status-vocabulary doc/code drift | Low | Docs | No |
| TD-11 | New student w/ no payment shows OVERDUE | Product decision | Correctness/UX | No |
| TD-12 | Calendar not coverage-aware | Low | UX | No |
| TD-13 | Build/observability hygiene (logs, legacy script) | Low | Hygiene | No |

TD-7/8/9 are scoped for **Stage 9 (Performance Audit — findings only, no implementation)**.
TD-11 requires a product decision and is the most likely to surface as a user-visible
question (see Known Limitations #2).

---

## Test Verification

```
Command:  npm test  (vitest run)
Result:   Test Files  11 passed (11)
          Tests       169 passed (169)
Status:   PASS
```

---

## Build Verification

```
Command:  npm run build  (vite v8.0.12)
Result:   ✓ 80 modules transformed · built successfully
Status:   PASS

Warnings: [INEFFECTIVE_DYNAMIC_IMPORT] on paymentService.js and
          p1_imports_context.jsx (static + dynamic import of same module).
Assessment: Pre-existing chunking warning only. No functional impact.
            Not deployment-blocking. (Tracked under TD-13 hygiene.)
```

---

## Known Limitations

1. **Performance (TD-7/8/9):** PropertyDetail does a per-student (N+1) coverage fetch on
   cold load; cache invalidation nukes the whole map on any mutation. Correct, but not
   optimal at scale. No correctness impact.
2. **New-student state (TD-11):** an ACTIVE student with no payment yet classifies as
   OVERDUE ("No coverage recorded"). May misrepresent fresh intake until first payment.
   Product decision pending.
3. **Calendar (TD-12)** is not yet coverage-aware.
4. **Build chunk warnings (TD-13)** remain (harmless).
5. **Stage 8/9 audits** not yet formally signed off (this report is the pre-audit state).

None are deployment blockers.

---

## Reliability Validation (observed/verified)

| Check | Result |
|---|---|
| Record payment updates coverage immediately (no F5) | ✓ |
| Edit payment updates coverage immediately (no F5) | ✓ |
| Delete payment updates coverage immediately (no F5) | ✓ |
| Room coverage counts update immediately | ✓ |
| Dashboard / Finances / Students update immediately | ✓ |
| Coverage rebuild failures surfaced (no silent staleness) | ✓ (TD-5) |
| Duplicate submit guarded (UI + service idempotency) | ✓ (TD-6) |
| Coverage recalculation deterministic (full-ledger replay) | ✓ |
| Single status vocabulary across all views | ✓ |

> Caveat flagged during Stage 8E (Rutendo trace, `RUTENDO_COVERAGE_TRACE.md`): the engine
> math is correct, but a UI value can read stale if a view renders against an uninvalidated
> cache or an outdated "today" — this is the robustness motivation behind TD-8. Worth
> confirming during Stage 8 before production sign-off.

---

## Rollback Information

```
Rollback commit:  7513dbd   (Phase 4B.11 — last stable pre-stabilization baseline)
Rollback tag:     none on 7513dbd; nearest stabilization tag = stabilization-td5-complete (78e2344)
Procedure:
    git checkout 7513dbd
    npm ci && npm run build
    redeploy previous build
```

`7513dbd` is the commit immediately before the TD-5→TD-4 stabilization series and is the
clean rollback point if the unified-status rollout needs to be reverted wholesale.

---

## Deployment Information

```
Deployment commit:  5d8eca3   (HEAD of sprint5-5-ui-work)
                    "Sprint 5.5 Stabilization: TD-1 to TD-4 complete"
Deployment tag:     stabilization-sprint5.5-production   (to be created at deploy time)
Branch:             sprint5-5-ui-work  → merge to main per release process
```

> The deployment tag does not yet exist. Create it at deploy time:
> `git tag -a stabilization-sprint5.5-production -m "Sprint 5.5 stabilization production deploy" 5d8eca3`

---

## Recommendation

**DEPLOY** (after Stage 8/9 sign-off).

The system now runs on a unified coverage engine with reliable payment mutations,
consistent Dashboard/Finances/Students status, surfaced rebuild failures, and
deterministic recalculation. All remaining debt is performance, maintainability, or a
product decision — not business-critical correctness.

| Field | Value |
|---|---|
| Rollback commit | `7513dbd` |
| Deployment commit | `5d8eca3` |
| Tests | 169 / 169 passing |
| Build | Production build successful |
| Status | Ready for deployment (pending Stage 8/9 sign-off) |
