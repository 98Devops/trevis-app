# Stabilization — TD-5: Eliminate Silent Coverage Rebuild Failures

**Stage:** 2 of 9 (Stabilization Sprint) · **Status:** ✅ Complete · **Tests:** 148/148 passing
(143 prior + 5 new).

---

## Business risk removed

Payment **edit** and **delete** ran the post-mutation coverage rebuild inside a `try/catch` that
logged the error and then returned a **clean success**:

```js
try { await rebuildStudentCoverage(studentId); }
catch (e) { console.error(...); /* don't fail the update */ }
return { data: true, error: null };
```

Result: the payment row changed, but `students.coverage_*` could silently go **stale**, and the
operator was told it worked. `recordPaymentWithCoverage` (create) was worse — a rebuild throw
bubbled up as a raw exception *after* the payment row was already inserted, so the UI showed a
generic failure even though the payment had been recorded.

This violated two constitution principles: **No silent failures** (§6.10) and **No hidden state**
(§6.11).

## Solution

Coverage rebuild failure is now a **first-class, surfaced** part of the mutation result.

### Service layer (`paymentService.js`, `coverageDatabaseService.js`)
- New shared helper `rebuildCoverageSafely(studentId, context)` in `paymentService.js`: runs
  `rebuildStudentCoverage` with **one automatic retry**, never throws, returns `{ ok, error }`.
- `updatePayment` / `deletePayment` now return `{ data: true, error: null, rebuildError }`.
  - `error` still represents the **row write** result (unchanged contract).
  - `rebuildError` is non-null **only** when the write succeeded but coverage failed to rebuild.
- `recordPaymentWithCoverage` now returns `{ payment, coverage, rebuildError }` with the same
  one-retry logic, instead of throwing the rebuild error after the insert.

> Design rationale: the payment ledger is the source of truth and the row write genuinely
> succeeded, so we do **not** roll it back. We surface the rebuild failure so the user can act
> (retry / run repair via `coverageRepairService`). Coverage remains deterministically
> re-derivable from the ledger at any time.

### UI layer (`p3_modals.jsx`, `App.jsx`)
Every primary handler now inspects `rebuildError` and warns the user instead of reporting clean
success:
- `handleEditPayment`, `handleDeletePayment`, `EditPaymentInline.onSave`, and the inline
  **amount** / **date** edits → `alert("… coverage may be out of date — please use Repair coverage
  or try again …")`.
- `App.handleRecordPayment` → `showToast(…, 'error')`.

Latent gap also fixed: the `EditPaymentInline` and inline amount/date editors were **not**
invalidating the coverage cache (only the top-level handlers were). Cache invalidation
(`setCoverageCache(new Map())` + timestamp bump) was added so every edit path is consistent with
Phase 4B.11.

## Tests

`src/services/paymentRebuildFailure.test.js` (5 tests), mocking `supabase` and
`coverageDatabaseService.rebuildStudentCoverage`:
- updatePayment: rebuild fail → `error: null` + non-null `rebuildError`, rebuild called **twice** (retry).
- updatePayment: rebuild success → `rebuildError: null`, called once.
- updatePayment: first attempt fails, retry succeeds → `rebuildError: null`, called twice.
- deletePayment: rebuild fail → surfaced; rebuild success → clean.

## Files changed
- `src/services/paymentService.js` — `rebuildCoverageSafely` + surfaced `rebuildError` in update/delete.
- `src/services/coverageDatabaseService.js` — surfaced `rebuildError` in `recordPaymentWithCoverage`.
- `src/parts/p3_modals.jsx` — surface rebuild warnings + add missing cache invalidation in inline edits.
- `src/App.jsx` — surface rebuild warning on create via toast.
- `src/services/paymentRebuildFailure.test.js` — new (5 tests).

## What you should see on localhost (verification)
Normal use is **unchanged** — successful payment create/edit/delete behaves exactly as before
(instant UI update, no F5). The new behavior only appears when the coverage rebuild genuinely
fails (e.g. DB blip):
- **Create:** a red toast bottom-right: *"Payment recorded, but coverage update failed — coverage
  may be out of date. Try again or run repair."*
- **Edit/Delete:** a browser alert: *"Payment saved/deleted, but the coverage update failed.
  Coverage may be out of date — please use Repair coverage or try again."*

To deliberately trigger it for a demo you would have to force the rebuild to fail (e.g. temporarily
break the room-rent lookup); under normal conditions you should simply confirm payments still save
and update instantly with **no** spurious warnings.

## Git checkpoint (recommended)
```
git add src/services/paymentService.js src/services/coverageDatabaseService.js \
        src/parts/p3_modals.jsx src/App.jsx src/services/paymentRebuildFailure.test.js \
        STABILIZATION_TD5_SILENT_REBUILD_FAILURES.md
git commit -m "TD-5: surface coverage rebuild failures (no silent stale coverage) + tests"
git tag -a stabilization-td5-complete -m "TD-5 complete: rebuild failures surfaced, 148/148 passing"
```
