-- ═══════════════════════════════════════════════════════════
-- R1 — RETIRE ALL SQL COVERAGE WRITERS  (COMPLETE — extended 2026-06-16)
-- "One engine. One truth. Only rebuildStudentCoverage() (JS) writes coverage."
-- ═══════════════════════════════════════════════════════════
--
-- WHY (see DATA_TRUTH_AUDIT.md + COVERAGE_WRITER_INVENTORY.md):
--   students.{coverage_start, coverage_end, daily_rate, next_due_date,
--   billing_anchor_date} are the AUTHORITATIVE responsibility of the JS engine
--   `rebuildStudentCoverage()` (Math.round, full payment_date-ASC replay, correct
--   prepaid-day preservation). It is the ONLY writer the live app uses.
--
--   The full SQL sweep (33 .sql files) found a SECOND and THIRD independent writer
--   family that the original R1 did NOT retire. All three must be neutralised:
--
--     (1) rebuild_student_coverage_from_payments(uuid)
--           FLOOR(amount/daily_rate) full replay -> loses 1 day/payment on every
--           non-even daily rate ($110->3.67, $260->8.67). Compounds per payment.
--
--     (2) populate_rent_cycle_fields()
--           MOST-RECENT-payment-only -> drops payment history & prepaid carry-over
--           (Rutendo: 28d vs correct 37d). DEFINED IN 3 SOURCE FILES with an
--           identical signature (sprint5.5_rent_cycle_schema.sql,
--           FIX_COVERAGE_DAYS_ROUNDING.sql, RUN_THIS_COMPLETE.sql). PostgreSQL keeps
--           only ONE definition: "last script run wins." Re-running any of those
--           source files silently re-installs a bad writer over this stub. Those
--           files are being moved to supabase/_archive/ so they cannot be innocently
--           re-run; this stub is the live definition, set LAST below.
--
--     (3) calculate_coverage(numeric, numeric, date)  +  its STEP 6/7 DO blocks
--           A SECOND, INDEPENDENT engine (FLOOR, IMMUTABLE) in
--           sprint5.5_flexible_rent_cycles{,_CORRECTED}.sql. The STEP 6/7 anon DO
--           blocks call it to overwrite students.coverage_* from the most-recent
--           payment. The ORIGINAL R1 wrongly excused this as "a pure helper that
--           does not write" — the inventory proved otherwise. It is retired here.
--
--   The application NEVER calls any of these via RPC (verified: zero supabase.rpc()
--   references in src/ except dead, unimported _archive/coverageService.legacy.js).
--   No TRIGGER calls them either (every CREATE TRIGGER touches monthly_obligations or
--   auth only). They are dormant footguns: human-invocation only.
--
-- SAFETY: This script only removes WRITE paths; it changes NO row data. Safe to run
--   before OR after the R2 portfolio replay. Take a backup first (DATABASE_CLEANSING_PLAN.md §0).
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- (1) Retire the FLOOR full-replay writer.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION rebuild_student_coverage_from_payments(student_uuid UUID)
RETURNS TABLE (new_coverage_start date, new_coverage_end date,
               new_daily_rate numeric, new_next_due_date date)
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'USING RETIRED COVERAGE ENGINE. USE JS rebuildStudentCoverage(). (R1: rebuild_student_coverage_from_payments used FLOOR math.) See COVERAGE_WRITER_INVENTORY.md.';
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- (3) Retire the SECOND engine: calculate_coverage() + its read-side companions.
--     calculate_coverage is the math primitive the STEP 6/7 DO blocks used to write
--     student rows. Neutralising it makes those backfill blocks fail loudly if re-run.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION calculate_coverage(
  p_room_rent numeric,
  p_payment_amount numeric,
  p_payment_date date
) RETURNS TABLE (
  daily_rate numeric,
  days_covered integer,
  coverage_start date,
  coverage_end date
) LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'USING RETIRED COVERAGE ENGINE. USE JS rebuildStudentCoverage(). (R1: calculate_coverage was a second FLOOR engine; its STEP 6/7 backfill blocks overwrote student coverage.) See COVERAGE_WRITER_INVENTORY.md.';
END;
$$;

-- Read-side companions of the second engine (divergent 'PAID' vocabulary; unused by
-- the live app, which classifies via the JS statusClassifier). Drop to remove the trap.
-- If a DROP fails because of the view dependency, the DROP VIEW below clears it first.
DROP VIEW IF EXISTS student_coverage_status;
DROP FUNCTION IF EXISTS get_dashboard_kpis();
DROP FUNCTION IF EXISTS get_student_status(date);
DROP FUNCTION IF EXISTS get_days_status(date);

-- ─────────────────────────────────────────────────────────────
-- (2) Retire the most-recent-only writer — LAST, because it is the "last write wins"
--     signature. Whatever runs last in the editor is the live definition; making this
--     the final statement guarantees the live definition is the RAISE stub.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION populate_rent_cycle_fields()
RETURNS TABLE (students_processed integer, payments_updated integer,
               students_updated integer, errors_encountered integer)
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'USING RETIRED COVERAGE ENGINE. USE JS rebuildStudentCoverage(). (R1: populate_rent_cycle_fields used most-recent-payment-only math and dropped history.) See COVERAGE_WRITER_INVENTORY.md.';
END;
$$;

COMMENT ON FUNCTION rebuild_student_coverage_from_payments(UUID) IS
  'RETIRED (R1) 2026-06-16. FLOOR math. Coverage is written only by JS rebuildStudentCoverage().';
COMMENT ON FUNCTION calculate_coverage(numeric, numeric, date) IS
  'RETIRED (R1) 2026-06-16. Second FLOOR engine. Coverage is written only by JS rebuildStudentCoverage().';
COMMENT ON FUNCTION populate_rent_cycle_fields() IS
  'RETIRED (R1) 2026-06-16. Most-recent-payment-only math. Coverage is written only by JS rebuildStudentCoverage().';

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- NOT TOUCHED (intentionally — audited, do NOT write coverage columns):
--   • recalculate_student_balances() / trigger_recalculate_balances /
--     update_monthly_obligation — maintain the LEGACY monthly_obligations cash-basis
--     table (TD-10), a separate concern.
--   • execute_student_transfer() — audited: transfer logic only, no coverage writes.
-- ─────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════
-- VERIFICATION — run after COMMIT. Every writer must now RAISE, and the read-side
-- companions must be gone. Expected: all three SELECTs error with "USING RETIRED
-- COVERAGE ENGINE"; the regclass/proc lookups return NULL.
-- ═══════════════════════════════════════════════════════════
-- SELECT * FROM rebuild_student_coverage_from_payments('00000000-0000-0000-0000-000000000000');
-- SELECT * FROM calculate_coverage(110, 110, CURRENT_DATE);
-- SELECT * FROM populate_rent_cycle_fields();
-- SELECT to_regclass('student_coverage_status')                         AS view_should_be_null;
-- SELECT to_regprocedure('get_dashboard_kpis()')                        AS kpi_should_be_null;
-- SELECT to_regprocedure('get_student_status(date)')                    AS status_should_be_null;
-- SELECT to_regprocedure('get_days_status(date)')                       AS days_should_be_null;
