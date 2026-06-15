# Stabilization — TD-1: Orphaned Wrong-Math Coverage Engine Archived

**Stage:** 4 of 9 · **Status:** ✅ Complete · **Tests:** 150/150 passing (unchanged).

---

## Business risk removed

`src/services/coverageService.js` was a leftover early draft of the Sprint 5.5 coverage
engine. It was **orphaned** — zero `.jsx`/service files imported it (verified via
`grep -rn coverageService src` and `grep -rn "from ['\"].*coverageService['\"]" src/`,
both empty) — but it sat in the live `src/services/` directory next to the real engine,
computing coverage with **different, incorrect math**:

- `daysCovered = Math.floor(...)` — the real engine uses `Math.round`, so this
  reintroduces the "29 days instead of 30" off-by-one bug Phase 1/2 fixed.
- `coverage_start = payment_date` always — no early-payment / prepaid-day preservation
  on renewal, so a student who pays early would silently lose unused prepaid days.
- Writes columns `date` / `method` instead of the real schema's `payment_date` /
  `payment_method`.
- A different status mapping (`daysCovered > 7 ⇒ 'PAID'`) — a second, contradictory
  definition of "paid" alongside the coverage classifier.

**Risk:** A "loaded gun" — any future developer (or AI assistant) searching for
"coverage service" could find this file, assume it's live, and wire it in. That would
silently reintroduce prepaid-day loss, off-by-one coverage dates, and a second status
system — exactly the bugs this stabilization sprint exists to prevent (Rules 1, 3, 5).

## Solution

1. **Verified orphaned status** — no source file, test, or component imports
   `coverageService.js` (only two Sprint 5.5 planning docs referenced it as a *target*,
   not as wired-up code).
2. **Archived, not deleted** — `git mv src/services/coverageService.js
   src/services/_archive/coverageService.legacy.js`, preserving git history (more
   reversible than a hard delete; still removes the trap from the active `services/`
   directory).
3. **Added a "DEAD CODE — DO NOT IMPORT" banner** to the top of the archived file,
   spelling out exactly why it's wrong (Math.floor vs Math.round, no prepaid
   preservation, wrong column names, different status thresholds) and pointing to the
   authoritative chain: `rentCycleCalculator.js` → `paymentProcessor.js` →
   `statusClassifier.js` → `coverageDatabaseService.js`. Also fixed its relative import
   path (`../lib/supabase` → `../../lib/supabase`) since it moved one directory deeper —
   the file remains syntactically valid as a historical reference even though it must
   never be imported.
4. **Corrected stale planning docs** — `SPRINT5.5_FLEXIBLE_RENT_CYCLES.md` and
   `SPRINT5.5_IMPLEMENTATION_STATUS.md` both described `coverageService.js` as the
   shipped implementation. Added a correction notice at the top of each pointing to the
   archive location and the actual authoritative engine.

## Tests

No test ever imported `coverageService.js`. Ran the full suite after the move to confirm
nothing depends on the old path:

```
Test Files  10 passed (10)
     Tests  150 passed (150)
```

## Files changed

- `src/services/coverageService.js` → moved to
  `src/services/_archive/coverageService.legacy.js` (git history preserved via `git mv`),
  with dead-code banner + corrected import path.
- `SPRINT5.5_FLEXIBLE_RENT_CYCLES.md` — correction notice added.
- `SPRINT5.5_IMPLEMENTATION_STATUS.md` — correction notice added.
- `.claude/technical-debt-register.md` — TD-1 marked ✅ RESOLVED.

## What you should see on localhost (verification)

**Nothing changes.** This is the verification point itself: `coverageService.js` was
never imported by any running code, so the app's behavior — payments, coverage display,
dashboard KPIs, finances, students view — is **byte-for-byte identical** to before this
change. If anything *did* visibly change, that would indicate the file was secretly in
use and this archival was unsafe (it wasn't — confirmed by the grep checks and the
150/150 green test run).

What to check to confirm "no regression":
- App loads normally, no console errors about a missing module.
- Recording, editing, and deleting a payment still works exactly as in TD-5/TD-6
  verification.
- Dashboard KPIs, property cards, and student coverage badges look the same as before.

## Git checkpoint (recommended)

```
git add src/services/coverageService.js src/services/_archive/coverageService.legacy.js \
        SPRINT5.5_FLEXIBLE_RENT_CYCLES.md SPRINT5.5_IMPLEMENTATION_STATUS.md \
        .claude/technical-debt-register.md \
        STABILIZATION_TD1_ORPHANED_ENGINE_REMOVED.md
git commit -m "TD-1: archive orphaned wrong-math coverage engine (coverageService.js)"
git tag -a stabilization-td1-complete -m "TD-1 complete: dead coverage engine archived, 150/150 passing"
```
