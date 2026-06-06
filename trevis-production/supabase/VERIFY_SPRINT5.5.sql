-- ═══════════════════════════════════════════════════════════
-- SPRINT 5.5 VERIFICATION SCRIPT
-- Run this in Supabase SQL Editor to diagnose issues
-- ═══════════════════════════════════════════════════════════

-- TEST 1: Check if database objects exist
SELECT 'TEST 1: Database Objects' as test;

SELECT 
  'Functions' as object_type,
  COUNT(*) as count,
  STRING_AGG(routine_name, ', ') as names
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('get_dashboard_kpis', 'calculate_coverage', 'get_student_status', 'get_days_status')
UNION ALL
SELECT 
  'Views' as object_type,
  COUNT(*) as count,
  STRING_AGG(table_name, ', ') as names
FROM information_schema.tables 
WHERE table_name = 'student_coverage_status';

-- Expected: 4 functions, 1 view

-- TEST 2: Check if columns were added
SELECT 'TEST 2: New Columns' as test;

SELECT 
  table_name,
  COUNT(*) as new_columns,
  STRING_AGG(column_name, ', ') as column_names
FROM information_schema.columns 
WHERE table_name IN ('payments', 'students')
  AND column_name IN ('coverage_start_date', 'coverage_end_date', 'days_covered', 'coverage_start', 'coverage_end', 'daily_rate')
GROUP BY table_name;

-- Expected: payments table has 3 columns, students table has 3 columns

-- TEST 3: Check if payments were backfilled
SELECT 'TEST 3: Payment Backfill Status' as test;

SELECT 
  COUNT(*) as total_payments,
  COUNT(coverage_start_date) as payments_with_coverage,
  COUNT(*) - COUNT(coverage_start_date) as payments_missing_coverage,
  ROUND(100.0 * COUNT(coverage_start_date) / NULLIF(COUNT(*), 0), 1) as percentage_complete
FROM payments;

-- Expected: percentage_complete should be close to 100%

-- TEST 4: Check sample payments
SELECT 'TEST 4: Sample Payments' as test;

SELECT 
  id,
  student_id,
  amount,
  payment_date,
  coverage_start_date,
  coverage_end_date,
  days_covered
FROM payments
ORDER BY payment_date DESC
LIMIT 5;

-- Expected: All fields populated with dates and days

-- TEST 5: Check if students were updated
SELECT 'TEST 5: Student Coverage Status' as test;

SELECT 
  COUNT(*) as total_active_students,
  COUNT(coverage_end) as students_with_coverage,
  COUNT(*) - COUNT(coverage_end) as students_missing_coverage,
  ROUND(100.0 * COUNT(coverage_end) / NULLIF(COUNT(*), 0), 1) as percentage_complete
FROM students
WHERE status NOT IN ('VACANT', 'VACATED');

-- Expected: percentage_complete should be close to 100%

-- TEST 6: Check sample students
SELECT 'TEST 6: Sample Students' as test;

SELECT 
  id,
  full_name,
  coverage_start,
  coverage_end,
  daily_rate,
  status
FROM students
WHERE status NOT IN ('VACANT', 'VACATED')
  AND coverage_end IS NOT NULL
ORDER BY coverage_end ASC
LIMIT 5;

-- Expected: All fields populated, coverage_end dates should be recent

-- TEST 7: Check coverage status view
SELECT 'TEST 7: Coverage Status View' as test;

SELECT COUNT(*) as total_rows FROM student_coverage_status;

-- Expected: Should match number of active students

-- TEST 8: Check view sample data
SELECT 'TEST 8: View Sample Data' as test;

SELECT 
  name,
  property_name,
  room_no,
  monthly_rent,
  daily_rate,
  coverage_start,
  coverage_end,
  status,
  days_status,
  amount_overdue
FROM student_coverage_status
ORDER BY coverage_end ASC
LIMIT 5;

-- Expected: All fields populated with correct calculations

-- TEST 9: Check dashboard KPIs
SELECT 'TEST 9: Dashboard KPIs' as test;

SELECT * FROM get_dashboard_kpis();

-- Expected: Reasonable numbers for your data
-- total_students: total count
-- current_students: those with > 7 days coverage
-- expiring_soon: those with 1-7 days coverage
-- overdue_students: those with expired coverage
-- total_overdue_amount: sum of overdue amounts

-- TEST 10: Status distribution
SELECT 'TEST 10: Status Distribution' as test;

SELECT 
  status,
  COUNT(*) as student_count,
  ROUND(SUM(amount_overdue), 2) as total_overdue
FROM student_coverage_status
GROUP BY status
ORDER BY 
  CASE status
    WHEN 'PAID' THEN 1
    WHEN 'EXPIRING_SOON' THEN 2
    WHEN 'DUE_TODAY' THEN 3
    WHEN 'OVERDUE' THEN 4
    ELSE 5
  END;

-- Expected: Students distributed across statuses

-- ═══════════════════════════════════════════════════════════
-- SUMMARY REPORT
-- ═══════════════════════════════════════════════════════════

SELECT 'SUMMARY REPORT' as section;

WITH summary AS (
  SELECT 
    (SELECT COUNT(*) FROM payments WHERE coverage_start_date IS NOT NULL) as payments_ok,
    (SELECT COUNT(*) FROM payments) as total_payments,
    (SELECT COUNT(*) FROM students WHERE coverage_end IS NOT NULL AND status NOT IN ('VACANT', 'VACATED')) as students_ok,
    (SELECT COUNT(*) FROM students WHERE status NOT IN ('VACANT', 'VACATED')) as total_students,
    (SELECT COUNT(*) FROM student_coverage_status) as view_rows,
    (SELECT current_students FROM get_dashboard_kpis()) as kpi_current,
    (SELECT expiring_soon FROM get_dashboard_kpis()) as kpi_expiring,
    (SELECT overdue_students FROM get_dashboard_kpis()) as kpi_overdue
)
SELECT 
  CASE 
    WHEN payments_ok = total_payments AND students_ok = total_students AND view_rows > 0 THEN '✅ SPRINT 5.5 IS WORKING'
    WHEN payments_ok < total_payments THEN '❌ PAYMENTS NOT BACKFILLED'
    WHEN students_ok < total_students THEN '❌ STUDENTS NOT UPDATED'
    WHEN view_rows = 0 THEN '❌ VIEW RETURNS NO DATA'
    ELSE '⚠️ PARTIAL SUCCESS'
  END as status,
  payments_ok || '/' || total_payments as payments_status,
  students_ok || '/' || total_students as students_status,
  view_rows as view_data_rows,
  kpi_current as current_students,
  kpi_expiring as expiring_soon,
  kpi_overdue as overdue
FROM summary;

-- ═══════════════════════════════════════════════════════════
-- IF TESTS FAIL, RUN THE FIX BELOW
-- ═══════════════════════════════════════════════════════════

-- UNCOMMENT AND RUN THIS SECTION IF NEEDED:

/*
-- FIX 1: Backfill payments
DO $$
DECLARE
  v_payment RECORD;
  v_room_rent numeric;
  v_coverage RECORD;
  v_count integer := 0;
BEGIN
  FOR v_payment IN 
    SELECT p.id, p.student_id, p.amount, p.payment_date
    FROM payments p
    WHERE p.coverage_start_date IS NULL
  LOOP
    SELECT r.rent_per_bed INTO v_room_rent
    FROM students s
    JOIN rooms r ON s.room_id = r.id
    WHERE s.id = v_payment.student_id;
    
    IF v_room_rent IS NULL OR v_room_rent = 0 THEN CONTINUE; END IF;
    
    SELECT * INTO v_coverage
    FROM calculate_coverage(v_room_rent, v_payment.amount, v_payment.payment_date);
    
    UPDATE payments
    SET 
      coverage_start_date = v_coverage.coverage_start,
      coverage_end_date = v_coverage.coverage_end,
      days_covered = v_coverage.days_covered
    WHERE id = v_payment.id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Backfilled % payments', v_count;
END $$;

-- FIX 2: Update students
DO $$
DECLARE
  v_student RECORD;
  v_latest_payment RECORD;
  v_room_rent numeric;
  v_count integer := 0;
BEGIN
  FOR v_student IN 
    SELECT s.id, s.room_id
    FROM students s
    WHERE s.status NOT IN ('VACANT', 'VACATED')
  LOOP
    SELECT p.coverage_start_date, p.coverage_end_date
    INTO v_latest_payment
    FROM payments p
    WHERE p.student_id = v_student.id
      AND p.coverage_start_date IS NOT NULL
    ORDER BY p.payment_date DESC
    LIMIT 1;
    
    SELECT r.rent_per_bed INTO v_room_rent
    FROM rooms r WHERE r.id = v_student.room_id;
    
    IF v_latest_payment.coverage_start_date IS NOT NULL AND v_room_rent IS NOT NULL THEN
      UPDATE students
      SET 
        coverage_start = v_latest_payment.coverage_start_date,
        coverage_end = v_latest_payment.coverage_end_date,
        daily_rate = ROUND(v_room_rent / 30.0, 2)
      WHERE id = v_student.id;
      
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Updated % students', v_count;
END $$;

-- After running fixes, run the verification queries above again
*/
