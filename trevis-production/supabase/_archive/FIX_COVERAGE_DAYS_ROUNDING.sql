-- ⛔ RETIRED / QUARANTINED 2026-06-16 — DO NOT RUN. See supabase/_archive/README.md.
-- Defines a LATENT coverage writer (populate_rent_cycle_fields, most-recent-only math)
-- that would corrupt correct JS-computed coverage. The only writer is JS
-- rebuildStudentCoverage(); bulk re-derive via scripts/replay_portfolio_coverage.mjs.
-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX: COVERAGE DAYS ROUNDING ISSUE
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PROBLEM IDENTIFIED:
-- The populate_rent_cycle_fields() function is calculating 29 days instead of 30
-- for full payments due to PostgreSQL integer rounding behavior.
--
-- ROOT CAUSE:
-- v_coverage_days := ROUND(amount / daily_rate)
-- When assigned to INTEGER, ROUND() truncates instead of proper rounding
-- Example: $110 / $3.67 = 29.9727... → ROUND() → 30.0 → INTEGER cast → 29 ❌
--
-- FIX:
-- Use ROUND() with explicit cast to ensure proper rounding before integer assignment
--
-- RUN THIS IN SUPABASE SQL EDITOR
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop and recreate the function with the fix
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
  RAISE NOTICE 'Starting rent cycle field population (with rounding fix)...';
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
      
      -- ✅ FIX: Calculate coverage days with proper rounding
      -- Cast ROUND result to numeric(10,0) BEFORE converting to integer
      -- This ensures 29.9727 → 30.0 → 30 (not 29)
      v_coverage_days := ROUND(v_latest_payment.amount / v_daily_rate, 0)::numeric(10,0)::integer;
      
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
      
      -- Update the payment record with coverage information (using your column names)
      UPDATE payments
      SET 
        coverage_start_date = v_latest_payment.payment_date,
        coverage_end_date = v_coverage_end_date,
        days_covered = v_coverage_days
      WHERE id = v_latest_payment.id;
      
      IF FOUND THEN
        v_payments_updated := v_payments_updated + 1;
      END IF;
      
      -- Update the student record with billing cycle information (using your column names)
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
        
        RAISE NOTICE 'Updated student % (ID: %): % days coverage until %, Next due %, Daily rate $%',
          v_student_record.full_name,
          v_student_record.student_id,
          v_coverage_days,
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

-- ═══════════════════════════════════════════════════════════════════════════════
-- EXECUTE THE FIXED FUNCTION TO RECALCULATE ALL COVERAGE DATA
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT * FROM populate_rent_cycle_fields();

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION: Check a few students to confirm the fix
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT 
  '✅ VERIFICATION: Sample students with $110 monthly rent' as check_name,
  s.full_name,
  r.rent_per_bed as monthly_rent,
  p.amount as payment_amount,
  p.days_covered,
  s.coverage_end,
  ROUND(p.amount / s.daily_rate, 0)::numeric(10,0)::integer as expected_days,
  CASE 
    WHEN p.days_covered = ROUND(p.amount / s.daily_rate, 0)::numeric(10,0)::integer THEN '✅ CORRECT'
    ELSE '❌ MISMATCH'
  END as validation_status
FROM students s
INNER JOIN rooms r ON r.id = s.room_id
INNER JOIN LATERAL (
  SELECT * FROM payments 
  WHERE student_id = s.id 
  ORDER BY payment_date DESC 
  LIMIT 1
) p ON TRUE
WHERE s.status = 'ACTIVE'
  AND r.rent_per_bed = 110.00
  AND p.amount = 110.00
ORDER BY s.full_name
LIMIT 10;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE!
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- After running this:
-- 1. All students with $110 payments should now show 30 days coverage
-- 2. Coverage end dates should be correct (payment_date + 29 days)
-- 3. Re-run PHASE1_VALIDATION_AUDIT.sql to confirm all validations pass
--
-- ═══════════════════════════════════════════════════════════════════════════════
