-- ═══════════════════════════════════════════════════════════
-- R3 — COVERAGE INVARIANTS (Phase 4C-A #4)
-- Defense in depth: make the coverage_start corruption physically impossible to
-- STORE, regardless of any future application bug. The DB itself rejects it.
-- ═══════════════════════════════════════════════════════════
--
-- WHY: coverage_start/end/daily_rate/next_due_date are DERIVED CACHE of the
-- payment ledger (the only truth). Two bugs this cycle wrote bad cache:
-- FLOOR rounding, and last-slice coverage_start (collapsing to start == end).
-- The app is now fixed and auto-reconciles on every mutation, but a CHECK
-- constraint is a permanent backstop: even a future regression cannot persist a
-- coverage_start that is AFTER coverage_end.
--
-- IMPORTANT: coverage_start == coverage_end is VALID (a legitimate 1-day
-- coverage, e.g. a single small payment). So the invariant is start <= end,
-- NOT start < end. NULLs are allowed (no coverage yet); CHECK passes on NULL.
--
-- SAFETY: read-only pre-flight first. Adding the constraint FAILS if any
-- existing row violates it — so run the pre-flight, repair via R2 --apply if
-- needed (expect 0 after the 2026-06-18 repair), THEN add the constraint.
-- ═══════════════════════════════════════════════════════════

-- ── PRE-FLIGHT (read-only): must return 0 before adding the constraint. ──
SELECT COUNT(*) AS violations_must_be_zero
FROM students
WHERE coverage_start IS NOT NULL
  AND coverage_end IS NOT NULL
  AND coverage_start > coverage_end;

-- If the above is 0, run the rest. If > 0, STOP: run
--   node scripts/replay_portfolio_coverage.mjs --apply
-- to repair, re-check, then proceed.

-- ── Add the invariant. ──
ALTER TABLE students
  DROP CONSTRAINT IF EXISTS coverage_start_le_end;

ALTER TABLE students
  ADD CONSTRAINT coverage_start_le_end
  CHECK (
    coverage_start IS NULL
    OR coverage_end IS NULL
    OR coverage_start <= coverage_end
  );

COMMENT ON CONSTRAINT coverage_start_le_end ON students IS
  'Phase 4C-A #4. Derived coverage cache invariant: a stored coverage_start may '
  'never be after coverage_end (start == end is valid: a 1-day coverage). '
  'Backstop against any future writer bug. Truth is the payment ledger.';

-- ── VERIFY (read-only): the constraint exists. ──
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'coverage_start_le_end';
