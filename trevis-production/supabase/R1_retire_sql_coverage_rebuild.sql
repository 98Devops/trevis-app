-- ═══════════════════════════════════════════════════════════
-- R1 — RETIRE SQL COVERAGE REBUILD LOGIC
-- "One engine. One truth. Only rebuildStudentCoverage() (JS) writes coverage."
-- ═══════════════════════════════════════════════════════════
--
-- WHY (see DATA_TRUTH_AUDIT.md Findings 1 & 3):
--   Coverage columns (students.coverage_start / coverage_end / daily_rate /
--   next_due_date) are written by the authoritative JS engine
--   `rebuildStudentCoverage()` (Math.round, full payment_date-ASC replay,
--   correct prepaid-day preservation).
--
--   TWO SQL functions also write those columns with DIFFERENT, WRONG math:
--     • rebuild_student_coverage_from_payments(uuid)  -> uses FLOOR(amount/daily_rate)
--          => loses 1 day per payment for every non-even daily rate ($110, $260, ...).
--     • populate_rent_cycle_fields()                  -> uses MOST-RECENT payment only
--          => drops payment history & prepaid carry-over (e.g. Rutendo: 28d vs correct 37d).
--
--   The application NEVER calls these via RPC (verified: no supabase.rpc() reference
--   to either in src/). They are dormant footguns: any operator running them in the
--   SQL editor would silently overwrite correct JS-computed coverage with wrong values.
--
-- WHAT THIS DOES:
--   Retires both functions so they can no longer write coverage. Two options are
--   provided — pick ONE. Option A (recommended) is reversible; the originals live in
--   supabase/phase4b3_repair_stale_coverage.sql and sprint5.5_rent_cycle_schema.sql.
--
-- SAFETY: Run AFTER R2 portfolio replay has corrected stored data, OR before — either
--   order is safe because this script only removes WRITE paths; it changes no data.
--   Take a backup first (see DATABASE_CLEANSING_PLAN.md §0).
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- OPTION A (RECOMMENDED): Neutralise, don't drop.
-- Replace the bodies with a hard failure so any accidental call is loud, not silent.
-- Reversible: re-run the original CREATE OR REPLACE from the source files to restore.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION rebuild_student_coverage_from_payments(student_uuid UUID)
RETURNS TABLE (new_coverage_start date, new_coverage_end date,
               new_daily_rate numeric, new_next_due_date date)
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'RETIRED (R1): SQL coverage rebuild is disabled. Coverage is written ONLY by the JS engine rebuildStudentCoverage(). See DATA_TRUTH_AUDIT.md / R1_retire_sql_coverage_rebuild.sql.';
END;
$$;

CREATE OR REPLACE FUNCTION populate_rent_cycle_fields()
RETURNS TABLE (students_processed integer, payments_updated integer,
               students_updated integer, errors_encountered integer)
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'RETIRED (R1): SQL rent-cycle backfill is disabled (used most-recent-payment-only math and dropped history). Use the JS portfolio replay (R2). See DATA_TRUTH_AUDIT.md.';
END;
$$;

COMMENT ON FUNCTION rebuild_student_coverage_from_payments(UUID) IS
  'RETIRED (R1) 2026-06-16. Disabled — used FLOOR math. Coverage is written only by JS rebuildStudentCoverage().';
COMMENT ON FUNCTION populate_rent_cycle_fields() IS
  'RETIRED (R1) 2026-06-16. Disabled — used most-recent-payment-only math. Replaced by JS portfolio replay (R2).';

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- OPTION B (ALTERNATIVE): Hard drop. Irreversible without the source files.
-- Only use if you are certain nothing references them.
-- ─────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP FUNCTION IF EXISTS rebuild_student_coverage_from_payments(UUID);
-- DROP FUNCTION IF EXISTS populate_rent_cycle_fields();
-- COMMIT;

-- ─────────────────────────────────────────────────────────────
-- NOT TOUCHED (intentionally):
--   • recalculate_student_balances() / trigger_recalculate_balances /
--     update_monthly_obligation — these maintain the LEGACY monthly_obligations
--     (cash-basis) table, NOT coverage columns. They are a separate concern (TD-10).
--   • calculate_coverage() RPC — a pure helper; if it uses FLOOR it should be aligned
--     to ROUND in a follow-up, but it does not WRITE student coverage columns.
--   • student_coverage_status VIEW / get_dashboard_kpis() RPC — READ-only; the app uses
--     the JS classifier instead (TD-9 read-side consolidation is a separate follow-up).
-- ─────────────────────────────────────────────────────────────

-- VERIFICATION (run after): both calls must now raise the RETIRED exception.
-- SELECT * FROM rebuild_student_coverage_from_payments('00000000-0000-0000-0000-000000000000');
-- SELECT * FROM populate_rent_cycle_fields();
