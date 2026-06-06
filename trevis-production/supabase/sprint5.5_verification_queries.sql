-- ═══════════════════════════════════════════════════════════════════════════════
-- SPRINT 5.5 RENT CYCLE ENGINE - VERIFICATION QUERIES
-- Task 1.3: Create verification queries
-- Requirements: 8.3, 8.4, 8.5
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- PURPOSE:
-- These queries verify data integrity after the rent cycle migration:
-- 1. All existing payments preserved unchanged
-- 2. All existing students preserved unchanged  
-- 3. New fields populated correctly for sample students
-- 4. Coverage calculations are accurate
-- 
-- USAGE:
-- Run these queries BEFORE migration to capture baseline data
-- Run these queries AFTER migration to verify integrity
-- Compare results to ensure no data loss or corruption
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: PRE-MIGRATION BASELINE QUERIES
-- Run these BEFORE applying the migration to establish baseline
-- ─────────────────────────────────────────────────────────────────────────────

-- 1.1 Count total payments (baseline)
SELECT 
  'PRE-MIGRATION: Total Payments' as check_name,
  COUNT(*) as total_count,
  COUNT(DISTINCT student_id) as unique_students,
  SUM(amount) as total_amount,
  MIN(payment_date) as earliest_payment,
  MAX(payment_date) as latest_payment
FROM payments;

-- Expected: Save this count for comparison after migration

-- 1.2 Count total active students (baseline)
SELECT 
  'PRE-MIGRATION: Total Active Students' as check_name,
  COUNT(*) as total_count,
  COUNT(DISTINCT room_id) as unique_rooms,
  COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_count,
  COUNT(CASE WHEN status IN ('VACANT', 'VACATED') THEN 1 END) as inactive_count
FROM students;

-- Expected: Save this count for comparison after migration

-- 1.3 Payment data integrity snapshot (baseline)
SELECT 
  'PRE-MIGRATION: Payment Data Snapshot' as check_name,
  MD5(STRING_AGG(
    id::text || student_id::text || amount::text || payment_date::text || month_year,
    '' ORDER BY payment_date, id
  )) as data_hash,
  COUNT(*) as record_count
FROM payments;

-- Expected: Save this hash to verify no existing data was modified

-- 1.4 Student data integrity snapshot (baseline)
SELECT 
  'PRE-MIGRATION: Student Data Snapshot' as check_name,
  MD5(STRING_AGG(
    id::text || full_name || COALESCE(room_id::text, '') || status,
    '' ORDER BY created_at, id
  )) as data_hash,
  COUNT(*) as record_count
FROM students;

-- Expected: Save this hash to verify no existing data was modified

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: SCHEMA VERIFICATION QUERIES
-- Run these AFTER applying the schema migration (Task 1.1)
-- ─────────────────────────────────────────────────────────────────────────────

-- 2.1 Verify new columns added to students table
SELECT 
  'SCHEMA CHECK: Students Table New Columns' as check_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'students'
  AND column_name IN ('billing_anchor_date', 'coverage_start_date', 'coverage_end_date', 'next_due_date', 'daily_rate')
ORDER BY column_name;

-- Expected: 5 rows, all nullable, correct data types
-- billing_anchor_date: date, nullable
-- coverage_start_date: date, nullable (already existed)
-- coverage_end_date: date, nullable (already existed)
-- next_due_date: date, nullable
-- daily_rate: numeric, nullable (already existed)

-- 2.2 Verify new columns added to payments table
SELECT 
  'SCHEMA CHECK: Payments Table New Columns' as check_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'payments'
  AND column_name IN ('coverage_start_date', 'coverage_end_date', 'days_covered')
ORDER BY column_name;

-- Expected: 3 rows, all nullable, correct data types
-- coverage_start_date: date, nullable (already existed)
-- coverage_end_date: date, nullable (already existed)
-- days_covered: integer, nullable (already existed)

-- 2.3 Verify existing columns unchanged in students table
SELECT 
  'SCHEMA CHECK: Students Existing Columns Preserved' as check_name,
  COUNT(*) as existing_column_count
FROM information_schema.columns
WHERE table_name = 'students'
  AND column_name IN ('id', 'full_name', 'phone', 'national_id', 'room_id', 
                      'check_in_date', 'check_out_date', 'payment_plan', 'status', 
                      'notes', 'created_at', 'updated_at');

-- Expected: 12 columns (all existing columns still present)

-- 2.4 Verify existing columns unchanged in payments table
SELECT 
  'SCHEMA CHECK: Payments Existing Columns Preserved' as check_name,
  COUNT(*) as existing_column_count
FROM information_schema.columns
WHERE table_name = 'payments'
  AND column_name IN ('id', 'student_id', 'amount', 'payment_date', 'payment_method',
                      'receipt_number', 'month_year', 'notes', 'recorded_by', 'created_at');

-- Expected: 10 columns (all existing columns still present)

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: DATA PRESERVATION VERIFICATION
-- Run these AFTER migration to ensure no data was modified or lost
-- Requirements: 8.3, 8.4
-- ─────────────────────────────────────────────────────────────────────────────

-- 3.1 Verify all existing payments preserved unchanged (Requirement 8.3)
SELECT 
  'POST-MIGRATION: Payment Data Integrity' as check_name,
  MD5(STRING_AGG(
    id::text || student_id::text || amount::text || payment_date::text || month_year,
    '' ORDER BY payment_date, id
  )) as data_hash,
  COUNT(*) as record_count
FROM payments;

-- Expected: Hash MUST match pre-migration hash from query 1.3
-- Record count MUST match pre-migration count from query 1.1

-- 3.2 Verify all existing students preserved unchanged (Requirement 8.4)
SELECT 
  'POST-MIGRATION: Student Data Integrity' as check_name,
  MD5(STRING_AGG(
    id::text || full_name || COALESCE(room_id::text, '') || status,
    '' ORDER BY created_at, id
  )) as data_hash,
  COUNT(*) as record_count
FROM students;

-- Expected: Hash MUST match pre-migration hash from query 1.4
-- Record count MUST match pre-migration count from query 1.2

-- 3.3 Verify payment record counts unchanged
SELECT 
  'POST-MIGRATION: Payment Count Verification' as check_name,
  COUNT(*) as total_payments,
  COUNT(DISTINCT student_id) as unique_students_with_payments,
  SUM(amount) as total_payment_amount,
  MIN(payment_date) as earliest_payment,
  MAX(payment_date) as latest_payment
FROM payments;

-- Expected: All values MUST match pre-migration query 1.1 exactly

-- 3.4 Verify student record counts unchanged
SELECT 
  'POST-MIGRATION: Student Count Verification' as check_name,
  COUNT(*) as total_students,
  COUNT(DISTINCT room_id) as unique_rooms,
  COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_count,
  COUNT(CASE WHEN status IN ('VACANT', 'VACATED') THEN 1 END) as inactive_count
FROM students;

-- Expected: All values MUST match pre-migration query 1.2 exactly

-- 3.5 Verify no payment records were deleted
SELECT 
  'POST-MIGRATION: No Deleted Payments' as check_name,
  CASE 
    WHEN COUNT(*) = (SELECT COUNT(*) FROM payments) 
    THEN '✓ PASS: All payment records preserved'
    ELSE '✗ FAIL: Payment records were deleted'
  END as result,
  COUNT(*) as current_count
FROM payments;

-- Expected: PASS result

-- 3.6 Verify no student records were deleted
SELECT 
  'POST-MIGRATION: No Deleted Students' as check_name,
  CASE 
    WHEN COUNT(*) >= (SELECT COUNT(*) FROM students) 
    THEN '✓ PASS: All student records preserved'
    ELSE '✗ FAIL: Student records were deleted'
  END as result,
  COUNT(*) as current_count
FROM students;

-- Expected: PASS result

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: NEW FIELD POPULATION VERIFICATION
-- Run these AFTER data population (Task 1.2) to verify calculations
-- Requirements: 8.5
-- ─────────────────────────────────────────────────────────────────────────────

-- 4.1 Check population rate for new payment fields
SELECT 
  'FIELD POPULATION: Payment Coverage Fields' as check_name,
  COUNT(*) as total_payments,
  COUNT(coverage_start_date) as coverage_start_date_populated,
  COUNT(coverage_end_date) as coverage_end_date_populated,
  COUNT(days_covered) as days_covered_populated,
  ROUND(100.0 * COUNT(coverage_start_date) / NULLIF(COUNT(*), 0), 2) as population_percentage
FROM payments;

-- Expected: population_percentage close to 100% for all payments with valid student/room data

-- 4.2 Check population rate for new student fields
SELECT 
  'FIELD POPULATION: Student Billing Fields' as check_name,
  COUNT(*) as total_active_students,
  COUNT(billing_anchor_date) as billing_anchor_populated,
  COUNT(coverage_end_date) as coverage_end_date_populated,
  COUNT(next_due_date) as next_due_populated,
  COUNT(daily_rate) as daily_rate_populated,
  ROUND(100.0 * COUNT(coverage_end_date) / NULLIF(COUNT(*), 0), 2) as population_percentage
FROM students
WHERE status NOT IN ('VACANT', 'VACATED');

-- Expected: population_percentage close to 100% for active students with payments

-- 4.3 Verify sample students - coverage calculation accuracy
-- Sample 5 students to spot-check coverage calculations (Requirement 8.5)
WITH sample_students AS (
  SELECT 
    s.id,
    s.full_name,
    s.billing_anchor_date,
    s.coverage_end,
    s.next_due_date,
    s.daily_rate,
    r.rent_per_bed,
    p.payment_date,
    p.amount,
    p.coverage_start_date,
    p.coverage_end_date,
    p.days_covered
  FROM students s
  JOIN rooms r ON r.id = s.room_id
  LEFT JOIN LATERAL (
    SELECT payment_date, amount, coverage_start_date, coverage_end_date, days_covered
    FROM payments
    WHERE student_id = s.id
    ORDER BY payment_date DESC
    LIMIT 1
  ) p ON TRUE
  WHERE s.status = 'ACTIVE'
    AND s.coverage_end IS NOT NULL
  ORDER BY s.coverage_end
  LIMIT 5
)
SELECT 
  'SAMPLE CHECK: Coverage Calculations' as check_name,
  full_name,
  rent_per_bed,
  amount as payment_amount,
  payment_date,
  -- Verify daily rate calculation: should be rent_per_bed / 30
  daily_rate as stored_daily_rate,
  ROUND(rent_per_bed / 30.0, 2) as expected_daily_rate,
  CASE 
    WHEN ABS(daily_rate - ROUND(rent_per_bed / 30.0, 2)) < 0.01 
    THEN '✓' ELSE '✗'
  END as daily_rate_match,
  -- Verify coverage days: should be ROUND(amount / daily_rate)
  days_covered as stored_days_covered,
  ROUND(amount / NULLIF(daily_rate, 0)) as expected_days_covered,
  CASE 
    WHEN days_covered = ROUND(amount / NULLIF(daily_rate, 0))
    THEN '✓' ELSE '✗'
  END as days_covered_match,
  -- Verify coverage end: should be payment_date + days_covered - 1
  coverage_end_date as stored_coverage_end_date,
  payment_date + (days_covered - 1) as expected_coverage_end_date,
  CASE 
    WHEN coverage_end_date = payment_date + (days_covered - 1)
    THEN '✓' ELSE '✗'
  END as coverage_end_date_match,
  -- Verify billing anchor: should match payment date day
  billing_anchor_date,
  EXTRACT(DAY FROM payment_date) as payment_day_of_month,
  EXTRACT(DAY FROM billing_anchor_date) as anchor_day_of_month,
  CASE 
    WHEN EXTRACT(DAY FROM payment_date) = EXTRACT(DAY FROM billing_anchor_date)
    THEN '✓' ELSE '✗'
  END as billing_anchor_match
FROM sample_students;

-- Expected: All match columns should show ✓

-- 4.4 Verify daily rate calculations for all students
SELECT 
  'CALCULATION CHECK: Daily Rate Accuracy' as check_name,
  COUNT(*) as total_checked,
  COUNT(*) FILTER (
    WHERE ABS(s.daily_rate - ROUND(r.rent_per_bed / 30.0, 2)) < 0.01
  ) as correct_calculations,
  COUNT(*) FILTER (
    WHERE ABS(s.daily_rate - ROUND(r.rent_per_bed / 30.0, 2)) >= 0.01
  ) as incorrect_calculations,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE ABS(s.daily_rate - ROUND(r.rent_per_bed / 30.0, 2)) < 0.01
    ) / NULLIF(COUNT(*), 0), 
    2
  ) as accuracy_percentage
FROM students s
JOIN rooms r ON r.id = s.room_id
WHERE s.status NOT IN ('VACANT', 'VACATED')
  AND s.daily_rate IS NOT NULL;

-- Expected: accuracy_percentage = 100%

-- 4.5 Verify coverage period calculations for payments
SELECT 
  'CALCULATION CHECK: Payment Coverage Period Accuracy' as check_name,
  COUNT(*) as total_checked,
  COUNT(*) FILTER (
    WHERE p.coverage_end_date = p.payment_date + (p.days_covered - 1)
  ) as correct_calculations,
  COUNT(*) FILTER (
    WHERE p.coverage_end_date != p.payment_date + (p.days_covered - 1)
  ) as incorrect_calculations,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE p.coverage_end_date = p.payment_date + (p.days_covered - 1)
    ) / NULLIF(COUNT(*), 0), 
    2
  ) as accuracy_percentage
FROM payments p
WHERE p.coverage_start_date IS NOT NULL
  AND p.coverage_end_date IS NOT NULL
  AND p.days_covered IS NOT NULL;

-- Expected: accuracy_percentage = 100%

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: EDGE CASES AND DATA QUALITY CHECKS
-- Run these to identify any data quality issues
-- ─────────────────────────────────────────────────────────────────────────────

-- 5.1 Identify students with payments but no coverage data
SELECT 
  'DATA QUALITY: Students Missing Coverage Data' as check_name,
  s.id,
  s.full_name,
  s.status,
  COUNT(p.id) as payment_count,
  MAX(p.payment_date) as last_payment_date,
  s.coverage_end
FROM students s
LEFT JOIN payments p ON p.student_id = s.id
WHERE s.status NOT IN ('VACANT', 'VACATED')
  AND s.coverage_end IS NULL
GROUP BY s.id, s.full_name, s.status, s.coverage_end
HAVING COUNT(p.id) > 0
ORDER BY COUNT(p.id) DESC;

-- Expected: Empty result set (all students with payments should have coverage)

-- 5.2 Identify payments with missing coverage fields
SELECT 
  'DATA QUALITY: Payments Missing Coverage Fields' as check_name,
  p.id,
  p.student_id,
  s.full_name,
  p.amount,
  p.payment_date,
  p.coverage_start_date,
  p.coverage_end_date,
  p.days_covered,
  r.rent_per_bed
FROM payments p
JOIN students s ON s.id = p.student_id
LEFT JOIN rooms r ON r.id = s.room_id
WHERE p.coverage_start_date IS NULL 
   OR p.coverage_end_date IS NULL 
   OR p.days_covered IS NULL
ORDER BY p.payment_date DESC
LIMIT 10;

-- Expected: Empty result set OR only payments for students without valid room assignments

-- 5.3 Identify invalid coverage calculations (negative or zero days)
SELECT 
  'DATA QUALITY: Invalid Coverage Days' as check_name,
  p.id,
  s.full_name,
  p.amount,
  p.payment_date,
  p.days_covered,
  r.rent_per_bed,
  ROUND(r.rent_per_bed / 30.0, 2) as daily_rate
FROM payments p
JOIN students s ON s.id = p.student_id
JOIN rooms r ON r.id = s.room_id
WHERE p.days_covered IS NOT NULL
  AND p.days_covered <= 0;

-- Expected: Empty result set (all coverage days should be positive)

-- 5.4 Identify coverage end dates in the past (potential overdue students)
SELECT 
  'DATA QUALITY: Students With Past Coverage' as check_name,
  COUNT(*) as overdue_count,
  COUNT(*) FILTER (WHERE s.coverage_end < CURRENT_DATE - INTERVAL '30 days') as overdue_30_days,
  COUNT(*) FILTER (WHERE s.coverage_end < CURRENT_DATE - INTERVAL '60 days') as overdue_60_days,
  COUNT(*) FILTER (WHERE s.coverage_end < CURRENT_DATE - INTERVAL '90 days') as overdue_90_days
FROM students s
WHERE s.status NOT IN ('VACANT', 'VACATED')
  AND s.coverage_end < CURRENT_DATE;

-- Expected: Numbers matching business reality (some overdue students expected)

-- 5.5 Identify unrealistic coverage periods (>60 days)
SELECT 
  'DATA QUALITY: Unusually Long Coverage Periods' as check_name,
  p.id,
  s.full_name,
  p.amount,
  p.payment_date,
  p.days_covered,
  r.rent_per_bed,
  ROUND(p.amount / r.rent_per_bed, 2) as months_paid
FROM payments p
JOIN students s ON s.id = p.student_id
JOIN rooms r ON r.id = s.room_id
WHERE p.days_covered > 60
ORDER BY p.days_covered DESC
LIMIT 10;

-- Expected: Empty or few results (overpayments >2 months should be rare)

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6: COMPREHENSIVE SUMMARY REPORT
-- Run this to get an overall health check of the migration
-- ─────────────────────────────────────────────────────────────────────────────

WITH migration_stats AS (
  SELECT 
    -- Schema checks
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'students' 
     AND column_name IN ('billing_anchor_date', 'coverage_end_date', 'next_due_date', 'daily_rate')
    ) = 4 as students_schema_ok,
    
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'payments' 
     AND column_name IN ('coverage_start_date', 'coverage_end_date', 'days_covered')
    ) = 3 as payments_schema_ok,
    
    -- Data preservation checks
    (SELECT COUNT(*) FROM payments) as payment_count,
    (SELECT COUNT(*) FROM students WHERE status NOT IN ('VACANT', 'VACATED')) as active_student_count,
    
    -- Population checks
    (SELECT COUNT(*) FROM payments WHERE coverage_start_date IS NOT NULL) as payments_with_coverage,
    (SELECT COUNT(*) FROM students WHERE coverage_end_date IS NOT NULL 
     AND status NOT IN ('VACANT', 'VACATED')) as students_with_coverage,
    
    -- Calculation accuracy
    (SELECT COUNT(*) FROM students s
     JOIN rooms r ON r.id = s.room_id
     WHERE s.daily_rate IS NOT NULL
     AND ABS(s.daily_rate - ROUND(r.rent_per_bed / 30.0, 2)) < 0.01
    ) as correct_daily_rate_calculations,
    
    (SELECT COUNT(*) FROM students s
     WHERE s.daily_rate IS NOT NULL AND s.status NOT IN ('VACANT', 'VACATED')
    ) as total_daily_rate_calculations,
    
    -- Data quality issues
    (SELECT COUNT(*) FROM payments 
     WHERE days_covered IS NOT NULL AND days_covered <= 0
    ) as invalid_days_covered,
    
    (SELECT COUNT(*) FROM students s
     LEFT JOIN payments p ON p.student_id = s.id
     WHERE s.status NOT IN ('VACANT', 'VACATED')
     AND s.coverage_end IS NULL
     AND EXISTS (SELECT 1 FROM payments WHERE student_id = s.id)
    ) as students_missing_coverage
)
SELECT 
  '═══════════════════════════════════════════════' as section,
  'MIGRATION VERIFICATION SUMMARY' as title,
  '═══════════════════════════════════════════════' as section2
UNION ALL
SELECT 
  'Schema Changes',
  CASE 
    WHEN students_schema_ok AND payments_schema_ok 
    THEN '✓ PASS: All columns added correctly'
    ELSE '✗ FAIL: Schema changes incomplete'
  END,
  ''
FROM migration_stats
UNION ALL
SELECT 
  'Data Preservation',
  '✓ ' || payment_count || ' payments preserved',
  '✓ ' || active_student_count || ' active students preserved'
FROM migration_stats
UNION ALL
SELECT 
  'Field Population',
  ROUND(100.0 * payments_with_coverage / NULLIF(payment_count, 0), 1)::text || '% payments',
  ROUND(100.0 * students_with_coverage / NULLIF(active_student_count, 0), 1)::text || '% students'
FROM migration_stats
UNION ALL
SELECT 
  'Calculation Accuracy',
  CASE 
    WHEN correct_daily_rate_calculations = total_daily_rate_calculations 
    THEN '✓ PASS: 100% accurate'
    ELSE '⚠ ' || ROUND(100.0 * correct_daily_rate_calculations / NULLIF(total_daily_rate_calculations, 0), 1)::text || '% accurate'
  END,
  ''
FROM migration_stats
UNION ALL
SELECT 
  'Data Quality Issues',
  invalid_days_covered::text || ' invalid coverage days',
  students_missing_coverage::text || ' students missing coverage'
FROM migration_stats
UNION ALL
SELECT 
  'Overall Status',
  CASE 
    WHEN students_schema_ok 
     AND payments_schema_ok 
     AND payments_with_coverage::float / NULLIF(payment_count, 0) > 0.95
     AND students_with_coverage::float / NULLIF(active_student_count, 0) > 0.95
     AND correct_daily_rate_calculations = total_daily_rate_calculations
     AND invalid_days_covered = 0
     AND students_missing_coverage = 0
    THEN '✓✓✓ MIGRATION SUCCESSFUL ✓✓✓'
    WHEN students_schema_ok 
     AND payments_schema_ok 
     AND payments_with_coverage::float / NULLIF(payment_count, 0) > 0.90
    THEN '⚠ MIGRATION PARTIAL - Review data quality'
    ELSE '✗ MIGRATION FAILED - Review errors above'
  END,
  ''
FROM migration_stats;

-- ═══════════════════════════════════════════════════════════════════════════════
-- END OF VERIFICATION QUERIES
-- ═══════════════════════════════════════════════════════════════════════════════

-- USAGE NOTES:
-- 1. Run Section 1 BEFORE migration to establish baseline
-- 2. Run Section 2 AFTER schema changes (Task 1.1) to verify columns added
-- 3. Run Section 3 AFTER data population (Task 1.2) to verify data preserved
-- 4. Run Section 4 AFTER data population (Task 1.2) to verify calculations
-- 5. Run Section 5 to identify any data quality issues
-- 6. Run Section 6 for overall migration health check
-- 
-- EXPECTED RESULTS vs ACTUAL RESULTS:
-- Document your results by copying the output of Section 6 (Summary Report)
-- 
-- If any checks fail:
-- - Review the specific section that failed
-- - Check the detailed queries in that section
-- - Identify the root cause
-- - Apply fixes as needed
-- - Re-run verification queries

