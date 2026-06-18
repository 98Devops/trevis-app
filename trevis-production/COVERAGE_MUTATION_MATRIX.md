# COVERAGE MUTATION MATRIX (Phase 4C-A #1)

**Date:** 2026-06-18 · **Audit — read-only; documents current behavior.**
**Purpose:** Every code path that mutates a coverage *input* (`payments`, `students.room_id`,
`students.status`, `rooms.rent_per_bed`) must trigger `rebuildStudentCoverage` for the affected
student(s). This matrix is the permanent record of which paths do, and which are GAPS to close.

**Coverage inputs** (truth): `payments.{amount, payment_date}`, `students.room_id` (→ which room's
rent), `students.status` (ACTIVE gating), `rooms.rent_per_bed` (→ daily_rate). Everything in
`students.{coverage_start, coverage_end, daily_rate, next_due_date}` is **derived cache**.

---

## The matrix

| # | Mutation | Code path | Blast radius | Rebuild today? | Verdict |
|---|----------|-----------|--------------|----------------|---------|
| 1 | Payment create | `coverageDatabaseService.recordPaymentWithCoverage` | 1 student | ✅ yes (rebuild + cache invalidate) | OK |
| 2 | Payment update (amount/date/method) | `paymentService.updatePayment` → `rebuildCoverageSafely` (1 retry, surfaces error) | 1 student | ✅ yes | OK |
| 3 | Payment delete | `paymentService.deletePayment` → `rebuildCoverageSafely` | 1 student | ✅ yes | OK |
| 4 | Inline payment field edit | `paymentService` (students update at L166) / `p3_modals` handlers | 1 student | ✅ yes (handlers invalidate cache + updatePayment rebuilds) | OK |
| 5 | **Room rent edit (`rent_per_bed`)** | `propertyService.updateRoom` → `rebuildRoomCoverage` | **ALL ACTIVE students in the room** | ✅ **YES (fixed 2026-06-18)** | ✅ CLOSED — fans out to all ACTIVE occupants only when rent actually changes |
| 6 | **Student transfer (room change)** | `transferService.executeTransfer` → RPC + `rebuildStudentCoverage` | 1 student (new rent) | ✅ **YES (fixed)** | ✅ CLOSED — rebuild after RPC; returns `rebuildError` |
| 7 | **Student update (room_id / status)** | `studentService.updateStudent` | 1 student | ✅ **YES (fixed)** | ✅ CLOSED — rebuilds when `room_id` or `status` present |
| 8 | **Student remove → VACATED** | `studentService.removeStudent` | 1 student | ✅ **YES (fixed)** | ✅ CLOSED — nulls derived coverage (replay is ACTIVE-only) |
| 9 | Student add | `studentService.addStudent` | 1 student | n/a (no payments yet) | OK (nothing to rebuild) |
| 10 | Room delete / remove | `propertyService.deleteRoom` / `removeRoom` | students in room | ❌ NO | 🟡 GAP (orphaned students — DATABASE_CLEANSING §7; deferred, separate concern) |

---

## Severity ranking (what to fix first)

1. **#5 Room rent edit — 🔴 CRITICAL.** Largest blast radius (whole room), completely silent. An
   owner correcting a room's rent leaves every ACTIVE student in it with a stale `daily_rate` and
   wrong coverage. Must fan-out a rebuild to **all** ACTIVE students in the room.
2. **#6 Transfer — 🔴.** New room = new rent = different day counts. RPC moves the student but no
   rebuild follows. Add a rebuild of the transferred student after the RPC succeeds.
3. **#7 Student update — 🔴.** If `room_id` changes (manual reassignment) or `status` flips
   ACTIVE↔other, coverage must rebuild. Currently doesn't.
4. **#8 / #10 — 🟡.** VACATED/removed students: stored coverage lingers. The classifier already
   excludes non-ACTIVE from metrics, so it's cosmetic, but a rebuild (→ null) keeps the table clean.

## The fix (Phase 4C-A #2) — one enforced contract

Route every mutation above through a single helper so a rebuild can never be forgotten:

```
withCoverageRebuild(studentIds, mutationFn):
  result = await mutationFn()
  for id of studentIds (ACTIVE): await rebuildCoverageSafely(id)
  invalidate cache (per-student)
  return { result, rebuildError }
```

- #5 rent edit → `studentIds` = all ACTIVE students in the room (a query before/after the update).
- #6 transfer, #7 update, #8 remove → `studentIds` = [the one student].
- Add tests asserting each path fires a rebuild and that stored == derived afterward.

## Verification
After the fix, the drift monitor (4C-A #3) re-running R2 `--dry-run` after each kind of mutation
must show `Drifted: 0`. This matrix is updated to ✅ as each gap closes.
