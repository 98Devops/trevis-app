# Stabilization — TD-6: Duplicate Payment Protection

**Stage:** 3 of 9 · **Status:** ✅ Complete · **Tests:** 150/150 passing (148 prior + 2 new).

---

## Business risk removed

`PaymentModal`'s Confirm button was only disabled on empty fields — it had **no in-flight guard**.
A fast double-click fired `recordPaymentWithCoverage` twice, creating **two payment rows**. The
deterministic coverage rebuild then faithfully summed both, **inflating the student's coverage**
(e.g. one $130 payment becoming $260 of coverage). Delete had a confirm step but no in-flight lock.

This violated the implicit reliability requirement "duplicate clicks must not corrupt billing."

## Solution — defense in depth

### Layer 1 — UI in-flight guards (`p3_modals.jsx`)
- **Create:** `PaymentModal` now has `isSubmitting` state. `handleSubmit` returns early if already
  submitting; the Confirm button is disabled and shows "Recording…" while in flight. Lock released
  on completion (or on error, so the user can retry).
- **Delete:** `StudentProfile` now has `isDeleting` state. `handleDeletePayment` returns early if a
  delete is in flight; both Cancel and Delete buttons are disabled, Delete shows "Deleting…". Lock
  released in a `finally`.
- **Edit:** already protected — `InlineEditField.handleSave` has a built-in `if (isSaving) return;`
  re-entrancy guard (verified, no change needed).

### Layer 2 — Service-layer idempotency (`coverageDatabaseService.recordPaymentWithCoverage`)
Before inserting, the service checks for a **recent identical payment** (same `student_id` +
`amount` + `payment_date`, `created_at` within the last 10 seconds). If found, it **suppresses**
the second insert and returns the existing row with `duplicateSuppressed: true`. This protects
against double-submits even if the UI guard is bypassed (render race, programmatic re-call).

> Schema verified: `payments.created_at timestamptz default now()` exists (`supabase/schema.sql`).
> Window chosen at 10s — long enough to absorb a double-click + slow round-trip, short enough that
> a legitimately intended second identical payment a few seconds later is rare. A genuine repeat
> can still be recorded after the window, or with any differing field (date/amount).

## Tests
`src/services/duplicatePaymentProtection.test.js` (2 tests):
- recent identical payment within window → **suppressed**, `insert` never called, returns existing row.
- no recent duplicate → normal insert path runs exactly once.

## Files changed
- `src/parts/p3_modals.jsx` — `isSubmitting` (create) + `isDeleting` (delete) guards & disabled buttons.
- `src/services/coverageDatabaseService.js` — recent-duplicate suppression in `recordPaymentWithCoverage`.
- `src/services/duplicatePaymentProtection.test.js` — new (2 tests).

## What you should see on localhost (verification)
- **Record Payment:** click Confirm → button immediately reads "Recording…" and is disabled; you
  cannot trigger a second payment by clicking again. One payment is recorded.
- **Rapid double-click test:** double-click Confirm fast → still exactly **one** payment appears in
  the student's history and coverage reflects a single payment (not doubled).
- **Delete:** in the delete-confirm box, clicking Delete disables both buttons and shows "Deleting…";
  a second click does nothing. One payment removed.
- All normal single-action flows look and behave exactly as before.

## Git checkpoint (recommended)
```
git add src/parts/p3_modals.jsx src/services/coverageDatabaseService.js \
        src/services/duplicatePaymentProtection.test.js \
        STABILIZATION_TD6_DUPLICATE_PAYMENT_PROTECTION.md .claude/technical-debt-register.md
git commit -m "TD-6: duplicate payment protection (UI in-flight guards + service idempotency)"
git tag -a stabilization-td6-complete -m "TD-6 complete: duplicate-submit protection, 150/150 passing"
```
