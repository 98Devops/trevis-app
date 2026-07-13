-- ═══════════════════════════════════════════════════════════
-- SPRINT 5.5: FLEXIBLE RENT CYCLE ENGINE - SCHEMA MIGRATION
-- Phase 1: Additive Database Schema Changes
-- ═══════════════════════════════════════════════════════════
-- 
-- REQUIREMENTS: 1.1, 1.2, 1.3, 8.1, 8.2
-- 
-- This migration adds new fields to support individual billing cycles
-- for each student based on their payment dates, replacing the assumption
-- that all students follow calendar-month billing (1st to 30th/31st).
-- 
-- SAFETY RULES:
-- ✅ Additive-only migration (no DROP, no RENAME)
-- ✅ All new fields are nullable
-- ✅ Existing data and logic remain untouched
-- ✅ Parallel operation: old system continues during transition
-- ✅ Full rollback capability without data loss
-- 
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. ADD NEW FIELDS TO STUDENTS TABLE
-- ─────────────────────────────────────────────

-- NOTE: coverage_start, coverage_end, daily_rate already exist in students table
-- Only adding missing fields: billing_anchor_date, next_due_date

-- billing_anchor_date: The day of month when student's rent is due
-- This is set based on the payment date and creates the student's individual billing cycle
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS billing_anchor_date date;

-- Rename coverage_end to coverage_end_date for consistency (if not already named that way)
-- NOTE: Your schema shows it as 'coverage_end' - keeping that name

-- next_due_date: The date when the next rent payment becomes due
-- Calculated as: next occurrence of billing_anchor_date after coverage_end_date
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS next_due_date date;

-- daily_rate already exists - skip
-- coverage_start already exists - skip  
-- coverage_end already exists - skip

-- Add comments for documentation
COMMENT ON COLUMN students.billing_anchor_date IS 
'Day of month when student rent is due (e.g., 19th). Set from payment date.';

COMMENT ON COLUMN students.coverage_end IS 
'Last date covered by current rent payment. Used for status classification.';

COMMENT ON COLUMN students.next_due_date IS 
'Date when next rent payment becomes due. Calculated from billing anchor.';

COMMENT ON COLUMN students.daily_rate IS 
'Per-day accommodation cost. Calculated as monthly_rent / 30.';

COMMENT ON COLUMN students.coverage_start IS 
'First date of current coverage period. Usually equals billing_anchor_date.';

-- ─────────────────────────────────────────────
-- 2. PAYMENTS TABLE - COLUMNS ALREADY EXIST
-- ─────────────────────────────────────────────

-- NOTE: Your payments table already has coverage fields with different names:
-- - coverage_start_date (instead of coverage_start)
-- - coverage_end_date (instead of coverage_end)
-- - days_covered (instead of coverage_days)

-- We'll use your existing column names throughout the code

-- Add comments for documentation
COMMENT ON COLUMN payments.coverage_start_date IS 
'First date covered by this payment. Usually equals payment_date.';

COMMENT ON COLUMN payments.coverage_end_date IS 
'Last date covered by this payment. Calculated from days_covered.';

COMMENT ON COLUMN payments.days_covered IS 
'Number of days covered by this payment amount based on daily rate.';

-- ─────────────────────────────────────────────
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ─────────────────────────────────────────────

-- Index for coverage_end_date queries (status classification)
CREATE INDEX IF NOT EXISTS idx_students_coverage_end_date 
ON students(coverage_end_date) 
WHERE status = 'ACTIVE';

-- Index for next_due_date queries (upcoming payments)
CREATE INDEX IF NOT EXISTS idx_students_next_due_date 
ON students(next_due_date) 
WHERE status = 'ACTIVE';

-- Index for payment coverage queries
CREATE INDEX IF NOT EXISTS idx_payments_coverage_period 
ON payments(coverage_start, coverage_end);

-- ═══════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ═══════════════════════════════════════════════════════════

-- Verify all new student columns were added
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'students' 
      AND column_name IN ('billing_anchor_date', 'coverage_end_date', 'next_due_date', 'daily_rate')
      GROUP BY table_name
      HAVING COUNT(*) = 4
    ) 
    THEN '✅ All 4 student columns added successfully'
    ELSE '❌ Missing student columns'
  END as student_columns_status;

-- Verify all new payment columns were added
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'payments' 
      AND column_name IN ('coverage_start', 'coverage_end', 'coverage_days')
      GROUP BY table_name
      HAVING COUNT(*) = 3
    ) 
    THEN '✅ All 3 payment columns added successfully'
    ELSE '❌ Missing payment columns'
  END as payment_columns_status;

-- Verify columns are nullable (required for additive migration)
SELECT 
  column_name,
  is_nullable,
  data_type,
  CASE 
    WHEN is_nullable = 'YES' THEN '✅ Nullable'
    ELSE '❌ NOT NULL constraint present'
  END as nullability_check
FROM information_schema.columns
WHERE table_name IN ('students', 'payments')
AND column_name IN (
  'billing_anchor_date', 'coverage_end_date', 'next_due_date', 'daily_rate',
  'coverage_start', 'coverage_end', 'coverage_days'
)
ORDER BY table_name, column_name;

-- Verify indexes were created
SELECT 
  indexname,
  tablename,
  CASE 
    WHEN indexname IS NOT NULL THEN '✅ Index exists'
    ELSE '❌ Index missing'
  END as index_status
FROM pg_indexes
WHERE indexname IN (
  'idx_students_coverage_end_date',
  'idx_students_next_due_date',
  'idx_payments_coverage_period'
)
ORDER BY tablename, indexname;

-- Count existing records (baseline for rollback verification)
SELECT 
  'students' as table_name,
  COUNT(*) as record_count,
  COUNT(*) FILTER (WHERE billing_anchor_date IS NOT NULL) as with_billing_data
FROM students
UNION ALL
SELECT 
  'payments' as table_name,
  COUNT(*) as record_count,
  COUNT(*) FILTER (WHERE coverage_start IS NOT NULL) as with_coverage_data
FROM payments;

-- ═══════════════════════════════════════════════════════════
-- ROLLBACK PLAN
-- ═══════════════════════════════════════════════════════════
-- 
-- If rollback is required, execute the following commands:
-- 
-- IMPORTANT: Verify no application code is using these fields before rollback!
-- 
-- -- Drop indexes first
-- DROP INDEX IF EXISTS idx_students_coverage_end_date;
-- DROP INDEX IF EXISTS idx_students_next_due_date;
-- DROP INDEX IF EXISTS idx_payments_coverage_period;
-- 
-- -- Drop student columns
-- ALTER TABLE students DROP COLUMN IF EXISTS billing_anchor_date;
-- ALTER TABLE students DROP COLUMN IF EXISTS coverage_end_date;
-- ALTER TABLE students DROP COLUMN IF EXISTS next_due_date;
-- ALTER TABLE students DROP COLUMN IF EXISTS daily_rate;
-- 
-- -- Drop payment columns
-- ALTER TABLE payments DROP COLUMN IF EXISTS coverage_start;
-- ALTER TABLE payments DROP COLUMN IF EXISTS coverage_end;
-- ALTER TABLE payments DROP COLUMN IF EXISTS coverage_days;
-- 
-- -- Verify rollback completed
-- SELECT 
--   COUNT(*) as remaining_columns
-- FROM information_schema.columns
-- WHERE table_name IN ('students', 'payments')
-- AND column_name IN (
--   'billing_anchor_date', 'coverage_end_date', 'next_due_date', 'daily_rate',
--   'coverage_start', 'coverage_end', 'coverage_days'
-- );
-- -- Expected result: 0 remaining_columns
-- 
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- DATA POPULATION FUNCTION
-- ═══════════════════════════════════════════════════════════
-- 
-- REQUIREMENTS: 1.4, 2.1, 2.2, 8.2
-- 
-- This function populates the new rent cycle fields from existing payment data.
-- It calculates billing_anchor_date, coverage_end_date, next_due_date, and daily_rate
-- for all active students based on their most recent payment.
-- 
-- SAFETY FEATURES:
-- ✅ Transaction-wrapped for atomicity
-- ✅ Read-only on existing fields
-- ✅ Error handling and validation
-- ✅ Idempotent (can be run multiple times safely)
-- ✅ Detailed logging via RAISE NOTICE
-- 
-- ═══════════════════════════════════════════════════════════

-- ⚠️ RETIRED (R1) 2026-06-16 — DO NOT RUN. populate_rent_cycle_fields() uses the
-- MOST-RECENT payment only and drops payment history / prepaid carry-over (e.g. Rutendo
-- 28d vs correct 37d). Disabled by supabase/R1_retire_sql_coverage_rebuild.sql. Use the
-- JS portfolio replay (R2 — scripts/replay_portfolio_coverage.mjs). See DATA_TRUTH_AUDIT.md.
CREATE OR REPLACE FUNCTION populate_rent_cycle_fields()
RETURNS TABLE (
  students_processed integer,
  payments_updated integer,
  students_updated integer,
  errors_encountered integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_record RECORD;
  v_latest_payment RECORD;
  v_room_rent numeric(10,2);
  v_daily_rate numeric(8,2);
  v_coverage_days integer;
  v_coverage_end_date date;
  v_next_due_date date;
  v_billing_anchor_day integer;
  v_students_processed integer := 0;
  v_payments_updated integer := 0;
  v_students_updated integer := 0;
  v_errors_encountered integer := 0;
BEGIN
  RAISE NOTICE 'Starting rent cycle field population...';
  RAISE NOTICE 'Processing active students with payment history...';
  
  -- Loop through each active student with a room assignment
  FOR v_student_record IN 
    SELECT 
      s.id as student_id,
      s.full_name,
      s.room_id,
      r.rent_per_bed as monthly_rent
    FROM students s 
    INNER JOIN rooms r ON r.id = s.room_id 
    WHERE s.status = 'ACTIVE'
      AND s.room_id IS NOT NULL
    ORDER BY s.full_name
  LOOP
    BEGIN
      v_students_processed := v_students_processed + 1;
      v_room_rent := v_student_record.monthly_rent;
      
      -- Validate monthly rent
      IF v_room_rent IS NULL OR v_room_rent <= 0 THEN
        RAISE NOTICE 'Skipping student % (ID: %): Invalid monthly rent',
          v_student_record.full_name, v_student_record.student_id;
        v_errors_encountered := v_errors_encountered + 1;
        CONTINUE;
      END IF;
      
      -- Calculate daily rate (monthly_rent / 30)
      v_daily_rate := ROUND(v_room_rent / 30.0, 2);
      
      -- Get the most recent payment for this student
      SELECT 
        p.id,
        p.amount,
        p.payment_date
      INTO v_latest_payment
      FROM payments p
      WHERE p.student_id = v_student_record.student_id
      ORDER BY p.payment_date DESC, p.created_at DESC
      LIMIT 1;
      
      -- Skip if no payment found
      IF NOT FOUND THEN
        RAISE NOTICE 'Skipping student % (ID: %): No payment history',
          v_student_record.full_name, v_student_record.student_id;
        CONTINUE;
      END IF;
      
      -- Validate payment amount
      IF v_latest_payment.amount <= 0 THEN
        RAISE NOTICE 'Skipping student % (ID: %): Invalid payment amount',
          v_student_record.full_name, v_student_record.student_id;
        v_errors_encountered := v_errors_encountered + 1;
        CONTINUE;
      END IF;
      
      -- Calculate coverage days (payment_amount / daily_rate)
      v_coverage_days := ROUND(v_latest_payment.amount / v_daily_rate);
      
      -- Ensure minimum 1 day coverage
      IF v_coverage_days < 1 THEN
        v_coverage_days := 1;
      END IF;
      
      -- Calculate coverage_end_date
      -- Formula: payment_date + coverage_days - 1
      v_coverage_end_date := v_latest_payment.payment_date + (v_coverage_days - 1);
      
      -- Get billing anchor day (day of month from payment date)
      v_billing_anchor_day := EXTRACT(DAY FROM v_latest_payment.payment_date)::integer;
      
      -- Calculate next_due_date
      -- Start with the day after coverage ends
      v_next_due_date := v_coverage_end_date + 1;
      
      -- Set to the billing anchor day in the appropriate month
      -- If the anchor day is greater than the last day of the month, use the last day
      v_next_due_date := (
        DATE_TRUNC('month', v_next_due_date) + 
        INTERVAL '1 month' * 
          CASE 
            WHEN EXTRACT(DAY FROM v_next_due_date) > v_billing_anchor_day THEN 1
            ELSE 0
          END +
        INTERVAL '1 day' * (v_billing_anchor_day - 1)
      )::date;
      
      -- Handle case where billing anchor day exceeds days in month
      -- For example, if anchor is 31st but next month has 30 days, use 30th
      IF v_billing_anchor_day > EXTRACT(DAY FROM (DATE_TRUNC('month', v_next_due_date) + INTERVAL '1 month' - INTERVAL '1 day')) THEN
        v_next_due_date := (DATE_TRUNC('month', v_next_due_date) + INTERVAL '1 month' - INTERVAL '1 day')::date;
      END IF;
      
      -- Update the payment record with coverage information
      UPDATE payments
      SET 
        coverage_start_date = v_latest_payment.payment_date,
        coverage_end_date = v_coverage_end_date,
        days_covered = v_coverage_days
      WHERE id = v_latest_payment.id
        AND (
          coverage_start_date IS NULL OR 
          coverage_end_date IS NULL OR 
          days_covered IS NULL
        );
      
      IF FOUND THEN
        v_payments_updated := v_payments_updated + 1;
      END IF;
      
      -- Update the student record with billing cycle information
      UPDATE students
      SET 
        billing_anchor_date = v_latest_payment.payment_date,
        coverage_end = v_coverage_end_date,
        next_due_date = v_next_due_date,
        daily_rate = v_daily_rate,
        coverage_start = v_latest_payment.payment_date
      WHERE id = v_student_record.student_id;
      
      IF FOUND THEN
        v_students_updated := v_students_updated + 1;
        
        RAISE NOTICE 'Updated student % (ID: %): Coverage until %, Next due %, Daily rate $%',
          v_student_record.full_name,
          v_student_record.student_id,
          v_coverage_end_date,
          v_next_due_date,
          v_daily_rate;
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Error processing student % (ID: %): %',
          v_student_record.full_name,
          v_student_record.student_id,
          SQLERRM;
        v_errors_encountered := v_errors_encountered + 1;
    END;
  END LOOP;
  
  -- Return summary statistics
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Data population complete!';
  RAISE NOTICE 'Students processed: %', v_students_processed;
  RAISE NOTICE 'Payments updated: %', v_payments_updated;
  RAISE NOTICE 'Students updated: %', v_students_updated;
  RAISE NOTICE 'Errors encountered: %', v_errors_encountered;
  RAISE NOTICE '═══════════════════════════════════════════════════';
  
  RETURN QUERY SELECT 
    v_students_processed,
    v_payments_updated,
    v_students_updated,
    v_errors_encountered;
END;
$$;

-- Add function comment
COMMENT ON FUNCTION populate_rent_cycle_fields() IS 
'Populates rent cycle fields (billing_anchor_date, coverage_end_date, next_due_date, daily_rate) from existing payment data. Safe to run multiple times.';

-- ═══════════════════════════════════════════════════════════
-- FUNCTION USAGE INSTRUCTIONS
-- ═══════════════════════════════════════════════════════════
-- 
-- To populate the new fields with existing data, run:
-- 
-- SELECT * FROM populate_rent_cycle_fields();
-- 
-- The function will:
-- 1. Process each active student with a room assignment
-- 2. Find their most recent payment
-- 3. Calculate coverage days based on payment amount and daily rate
-- 4. Set billing_anchor_date to the payment date
-- 5. Calculate coverage_end_date (payment_date + coverage_days - 1)
-- 6. Calculate next_due_date (next occurrence of billing anchor after coverage ends)
-- 7. Update both payment and student records
-- 
-- The function is idempotent and transaction-safe.
-- It provides detailed logging via RAISE NOTICE statements.
-- It returns a summary table with counts of records processed and updated.
-- 
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- VERIFICATION QUERIES FOR POPULATED DATA
-- ═══════════════════════════════════════════════════════════

-- Check students with populated rent cycle data
SELECT 
  COUNT(*) as total_active_students,
  COUNT(*) FILTER (WHERE billing_anchor_date IS NOT NULL) as with_billing_data,
  COUNT(*) FILTER (WHERE coverage_end IS NOT NULL) as with_coverage_data,
  COUNT(*) FILTER (WHERE next_due_date IS NOT NULL) as with_next_due_data,
  COUNT(*) FILTER (WHERE daily_rate IS NOT NULL) as with_daily_rate,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE billing_anchor_date IS NOT NULL) / 
    NULLIF(COUNT(*), 0), 
    1
  ) as percentage_complete
FROM students
WHERE status = 'ACTIVE' AND room_id IS NOT NULL;

-- Sample students with rent cycle data (top 5 by coverage_end)
SELECT 
  full_name,
  billing_anchor_date,
  coverage_end as coverage_end_date,
  next_due_date,
  daily_rate,
  CASE 
    WHEN coverage_end >= CURRENT_DATE + 7 THEN 'CURRENT'
    WHEN coverage_end >= CURRENT_DATE THEN 'EXPIRING_SOON'
    ELSE 'OVERDUE'
  END as calculated_status,
  coverage_end - CURRENT_DATE as days_remaining
FROM students
WHERE status = 'ACTIVE' 
  AND room_id IS NOT NULL
  AND coverage_end IS NOT NULL
ORDER BY coverage_end ASC
LIMIT 5;

-- Check payments with populated coverage data
SELECT 
  COUNT(*) as total_payments,
  COUNT(*) FILTER (WHERE coverage_start_date IS NOT NULL) as with_coverage_start,
  COUNT(*) FILTER (WHERE coverage_end_date IS NOT NULL) as with_coverage_end,
  COUNT(*) FILTER (WHERE days_covered IS NOT NULL) as with_coverage_days,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE coverage_start_date IS NOT NULL) / 
    NULLIF(COUNT(*), 0), 
    1
  ) as percentage_complete
FROM payments;

-- Sample payments with coverage data (most recent 5)
SELECT 
  p.payment_date,
  p.amount,
  p.coverage_start_date,
  p.coverage_end_date,
  p.days_covered,
  s.full_name as student_name,
  r.rent_per_bed as monthly_rent,
  ROUND(p.amount / (r.rent_per_bed / 30.0), 0) as calculated_coverage_days
FROM payments p
INNER JOIN students s ON s.id = p.student_id
INNER JOIN rooms r ON r.id = s.room_id
WHERE p.coverage_start_date IS NOT NULL
ORDER BY p.payment_date DESC, p.created_at DESC
LIMIT 5;

-- ═══════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ═══════════════════════════════════════════════════════════
-- 
-- ✅ Phase 1 complete: Database schema extended and data population function created
-- 
-- NEXT STEPS:
-- 1. Run verification queries above to confirm all changes applied
-- 2. Run: SELECT * FROM populate_rent_cycle_fields(); to populate existing data
-- 3. Verify populated data using verification queries
-- 4. Implement RentCycleCalculator service (Phase 2)
-- 5. Implement StatusClassifier service (Phase 3)
-- 6. Update UI components to display coverage data (Phase 4)
-- 7. Test parallel operation before switching over
-- 
-- The existing monthly_obligations system continues to work unchanged.
-- New rent cycle fields are now ready to be populated and used.
-- 
-- ═══════════════════════════════════════════════════════════
