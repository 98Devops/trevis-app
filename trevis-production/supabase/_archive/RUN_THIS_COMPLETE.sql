-- ⛔ RETIRED / QUARANTINED 2026-06-16 — DO NOT RUN (despite the filename). See
-- supabase/_archive/README.md. AUTO-EXECUTES populate_rent_cycle_fields() (most-recent-
-- only math) and would corrupt correct JS-computed coverage. The only writer is JS
-- rebuildStudentCoverage(); bulk re-derive via scripts/replay_portfolio_coverage.mjs.
-- ═══════════════════════════════════════════════════════════════════════════════
-- SPRINT 5.5: COMPLETE MIGRATION - RUN THIS IN SUPABASE SQL EDITOR
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- This file contains EVERYTHING you need to run in order:
-- 1. Create the population function
-- 2. Execute the population function
-- 3. Verify the data was populated correctly
-- 
-- Simply copy this entire file into Supabase SQL Editor and click Run
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: CREATE THE POPULATION FUNCTION
-- ═══════════════════════════════════════════════════════════════════════════════

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
      
      -- Update the payment record with coverage information (using your column names)
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

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: EXECUTE THE POPULATION FUNCTION
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT * FROM populate_rent_cycle_fields();

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: VERIFY DATA WAS POPULATED
-- ═══════════════════════════════════════════════════════════════════════════════

-- Check students table population
SELECT 
  '✅ STUDENTS TABLE' as check_name,
  COUNT(*) as total_students,
  COUNT(billing_anchor_date) as with_billing_anchor,
  COUNT(coverage_start) as with_coverage_start,
  COUNT(coverage_end) as with_coverage_end,
  COUNT(next_due_date) as with_next_due,
  COUNT(daily_rate) as with_daily_rate,
  ROUND(100.0 * COUNT(billing_anchor_date) / NULLIF(COUNT(*), 0), 1)::text || '%' as population_rate
FROM students 
WHERE status = 'ACTIVE' AND room_id IS NOT NULL;

-- Check payments table population
SELECT 
  '✅ PAYMENTS TABLE' as check_name,
  COUNT(*) as total_payments,
  COUNT(coverage_start_date) as with_coverage_start,
  COUNT(coverage_end_date) as with_coverage_end,
  COUNT(days_covered) as with_days_covered,
  ROUND(100.0 * COUNT(coverage_start_date) / NULLIF(COUNT(*), 0), 1)::text || '%' as population_rate
FROM payments;

-- Show sample student with coverage data
SELECT 
  '✅ SAMPLE STUDENT' as check_name,
  full_name,
  billing_anchor_date,
  coverage_start,
  coverage_end,
  next_due_date,
  daily_rate,
  CASE 
    WHEN coverage_end >= CURRENT_DATE + 7 THEN 'CURRENT ✅'
    WHEN coverage_end >= CURRENT_DATE THEN 'EXPIRING SOON ⚠️'
    ELSE 'OVERDUE ❌'
  END as status,
  (coverage_end - CURRENT_DATE)::text || ' days' as days_remaining_or_overdue
FROM students 
WHERE coverage_end IS NOT NULL
  AND status = 'ACTIVE'
ORDER BY coverage_end ASC
LIMIT 3;

-- Show sample payment with coverage data
SELECT 
  '✅ SAMPLE PAYMENT' as check_name,
  p.payment_date,
  p.amount,
  p.coverage_start_date,
  p.coverage_end_date,
  p.days_covered,
  s.full_name as student_name,
  r.rent_per_bed as monthly_rent,
  ROUND(p.amount / (r.rent_per_bed / 30.0), 0) as expected_days
FROM payments p
INNER JOIN students s ON s.id = p.student_id
INNER JOIN rooms r ON r.id = s.room_id
WHERE p.coverage_start_date IS NOT NULL
ORDER BY p.payment_date DESC
LIMIT 3;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE! 
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- Check the results above:
-- 
-- 1. Function execution should show:
--    - students_processed: (number of active students)
--    - payments_updated: (number of payments updated)
--    - students_updated: (number of students updated)
--    - errors_encountered: 0 (hopefully!)
-- 
-- 2. Students table check should show:
--    - population_rate close to 100%
-- 
-- 3. Payments table check should show:
--    - population_rate close to 100%
-- 
-- 4. Sample student should show:
--    - billing_anchor_date populated
--    - coverage dates populated
--    - status showing correctly
-- 
-- 5. Sample payment should show:
--    - coverage dates matching expected_days calculation
-- 
-- If everything looks good, Phase 1 is COMPLETE! ✅
-- 
-- ═══════════════════════════════════════════════════════════════════════════════
