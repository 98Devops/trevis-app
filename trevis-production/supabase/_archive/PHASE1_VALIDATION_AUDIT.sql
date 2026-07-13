-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 1 VALIDATION AUDIT
-- Must pass before proceeding to Phase 2
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- This audit validates 5 real students covering different payment scenarios:
-- 1. Full payment (amount = monthly rent)
-- 2. Partial payment (amount < monthly rent)
-- 3. Overpayment (amount > monthly rent)
-- 4. Early payment (payment before coverage_end_date)
-- 5. No payment / First payment
--
-- All calculations must be correct before Phase 2.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- VALIDATION 1: Full Payment Students
-- Expected: coverage = exactly 30 days
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  '1️⃣ FULL PAYMENT VALIDATION' as test_category,
  s.full_name,
  r.rent_per_bed as monthly_rent,
  p.amount as payment_amount,
  p.payment_date,
  
  -- Calculated fields to verify
  s.daily_rate,
  ROUND(r.rent_per_bed / 30.0, 2) as expected_daily_rate,
  CASE 
    WHEN ABS(s.daily_rate - ROUND(r.rent_per_bed / 30.0, 2)) < 0.01 
    THEN '✅' ELSE '❌' 
  END as daily_rate_check,
  
  p.days_covered,
  ROUND(p.amount / s.daily_rate) as expected_days,
  CASE 
    WHEN p.days_covered = ROUND(p.amount / s.daily_rate) 
    THEN '✅' ELSE '❌' 
  END as days_covered_check,
  
  s.billing_anchor_date,
  p.payment_date as expected_anchor,
  CASE 
    WHEN s.billing_anchor_date = p.payment_date 
    THEN '✅' ELSE '❌' 
  END as anchor_check,
  
  s.coverage_end,
  (p.payment_date + p.days_covered - 1)::date as expected_coverage_end,
  CASE 
    WHEN s.coverage_end = (p.payment_date + p.days_covered - 1)::date 
    THEN '✅' ELSE '❌' 
  END as coverage_end_check,
  
  s.next_due_date,
  (s.coverage_end + 1)::date as expected_next_due,
  CASE 
    WHEN s.next_due_date >= s.coverage_end 
    THEN '✅' ELSE '❌' 
  END as next_due_check,
  
  -- Overall validation
  CASE 
    WHEN ABS(s.daily_rate - ROUND(r.rent_per_bed / 30.0, 2)) < 0.01
      AND p.days_covered = ROUND(p.amount / s.daily_rate)
      AND s.billing_anchor_date = p.payment_date
      AND s.coverage_end = (p.payment_date + p.days_covered - 1)::date
      AND s.next_due_date >= s.coverage_end
      AND p.days_covered BETWEEN 29 AND 31  -- Full month should be ~30 days
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as overall_status

FROM students s
INNER JOIN rooms r ON r.id = s.room_id
INNER JOIN LATERAL (
  SELECT * FROM payments 
  WHERE student_id = s.id 
  ORDER BY payment_date DESC 
  LIMIT 1
) p ON TRUE
WHERE s.status = 'ACTIVE'
  AND s.coverage_end IS NOT NULL
  AND ABS(p.amount - r.rent_per_bed) < 5  -- Within $5 of monthly rent = full payment
ORDER BY s.full_name
LIMIT 2;

-- ─────────────────────────────────────────────────────────────────────────────
-- VALIDATION 2: Partial Payment Students
-- Expected: coverage < 30 days, proportional to payment
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  '2️⃣ PARTIAL PAYMENT VALIDATION' as test_category,
  s.full_name,
  r.rent_per_bed as monthly_rent,
  p.amount as payment_amount,
  ROUND(100.0 * p.amount / r.rent_per_bed, 1)::text || '%' as payment_percentage,
  p.payment_date,
  
  -- Calculated fields to verify
  s.daily_rate,
  ROUND(r.rent_per_bed / 30.0, 2) as expected_daily_rate,
  CASE 
    WHEN ABS(s.daily_rate - ROUND(r.rent_per_bed / 30.0, 2)) < 0.01 
    THEN '✅' ELSE '❌' 
  END as daily_rate_check,
  
  p.days_covered,
  ROUND(p.amount / s.daily_rate) as expected_days,
  CASE 
    WHEN p.days_covered = ROUND(p.amount / s.daily_rate) 
    THEN '✅' ELSE '❌' 
  END as days_covered_check,
  
  s.coverage_end,
  (p.payment_date + p.days_covered - 1)::date as expected_coverage_end,
  CASE 
    WHEN s.coverage_end = (p.payment_date + p.days_covered - 1)::date 
    THEN '✅' ELSE '❌' 
  END as coverage_end_check,
  
  -- Overall validation
  CASE 
    WHEN ABS(s.daily_rate - ROUND(r.rent_per_bed / 30.0, 2)) < 0.01
      AND p.days_covered = ROUND(p.amount / s.daily_rate)
      AND s.coverage_end = (p.payment_date + p.days_covered - 1)::date
      AND p.days_covered < 30  -- Partial payment should be less than full month
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as overall_status

FROM students s
INNER JOIN rooms r ON r.id = s.room_id
INNER JOIN LATERAL (
  SELECT * FROM payments 
  WHERE student_id = s.id 
  ORDER BY payment_date DESC 
  LIMIT 1
) p ON TRUE
WHERE s.status = 'ACTIVE'
  AND s.coverage_end IS NOT NULL
  AND p.amount < r.rent_per_bed - 5  -- More than $5 less than monthly rent = partial
ORDER BY p.amount ASC
LIMIT 2;

-- ─────────────────────────────────────────────────────────────────────────────
-- VALIDATION 3: Overpayment Students
-- Expected: coverage > 30 days, proportional to payment
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  '3️⃣ OVERPAYMENT VALIDATION' as test_category,
  s.full_name,
  r.rent_per_bed as monthly_rent,
  p.amount as payment_amount,
  ROUND(p.amount / r.rent_per_bed, 1) as months_paid,
  p.payment_date,
  
  -- Calculated fields to verify
  s.daily_rate,
  ROUND(r.rent_per_bed / 30.0, 2) as expected_daily_rate,
  CASE 
    WHEN ABS(s.daily_rate - ROUND(r.rent_per_bed / 30.0, 2)) < 0.01 
    THEN '✅' ELSE '❌' 
  END as daily_rate_check,
  
  p.days_covered,
  ROUND(p.amount / s.daily_rate) as expected_days,
  CASE 
    WHEN p.days_covered = ROUND(p.amount / s.daily_rate) 
    THEN '✅' ELSE '❌' 
  END as days_covered_check,
  
  s.coverage_end,
  (p.payment_date + p.days_covered - 1)::date as expected_coverage_end,
  CASE 
    WHEN s.coverage_end = (p.payment_date + p.days_covered - 1)::date 
    THEN '✅' ELSE '❌' 
  END as coverage_end_check,
  
  -- Overall validation
  CASE 
    WHEN ABS(s.daily_rate - ROUND(r.rent_per_bed / 30.0, 2)) < 0.01
      AND p.days_covered = ROUND(p.amount / s.daily_rate)
      AND s.coverage_end = (p.payment_date + p.days_covered - 1)::date
      AND p.days_covered > 30  -- Overpayment should be more than full month
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as overall_status

FROM students s
INNER JOIN rooms r ON r.id = s.room_id
INNER JOIN LATERAL (
  SELECT * FROM payments 
  WHERE student_id = s.id 
  ORDER BY payment_date DESC 
  LIMIT 1
) p ON TRUE
WHERE s.status = 'ACTIVE'
  AND s.coverage_end IS NOT NULL
  AND p.amount > r.rent_per_bed + 5  -- More than $5 over monthly rent = overpayment
ORDER BY p.amount DESC
LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- VALIDATION 4: Students with Multiple Payments (Early Payment Check)
-- Expected: Most recent payment determines current coverage
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  '4️⃣ MULTIPLE PAYMENTS (EARLY PAYMENT)' as test_category,
  s.full_name,
  payment_count,
  
  -- Most recent payment
  latest_payment_date,
  latest_amount,
  
  -- Current coverage
  s.coverage_end,
  (latest_payment_date + days_from_latest - 1)::date as expected_coverage_end,
  CASE 
    WHEN s.coverage_end = (latest_payment_date + days_from_latest - 1)::date 
    THEN '✅' ELSE '❌' 
  END as coverage_end_check,
  
  -- Overall validation
  CASE 
    WHEN s.coverage_end = (latest_payment_date + days_from_latest - 1)::date
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as overall_status

FROM students s
INNER JOIN rooms r ON r.id = s.room_id
INNER JOIN LATERAL (
  SELECT 
    COUNT(*) as payment_count,
    MAX(payment_date) as latest_payment_date,
    (SELECT amount FROM payments WHERE student_id = s.id ORDER BY payment_date DESC LIMIT 1) as latest_amount,
    (SELECT days_covered FROM payments WHERE student_id = s.id ORDER BY payment_date DESC LIMIT 1) as days_from_latest
  FROM payments 
  WHERE student_id = s.id
) p ON TRUE
WHERE s.status = 'ACTIVE'
  AND s.coverage_end IS NOT NULL
  AND payment_count > 1  -- Multiple payments
ORDER BY payment_count DESC
LIMIT 2;

-- ─────────────────────────────────────────────────────────────────────────────
-- VALIDATION 5: Students with No Coverage Data
-- Expected: Should be students with no payments OR inactive status
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  '5️⃣ NO COVERAGE DATA' as test_category,
  s.full_name,
  s.status,
  r.rent_per_bed as monthly_rent,
  
  -- Check for payments
  (SELECT COUNT(*) FROM payments WHERE student_id = s.id) as payment_count,
  (SELECT MAX(payment_date) FROM payments WHERE student_id = s.id) as last_payment_date,
  
  -- Coverage fields should be NULL
  s.billing_anchor_date,
  s.coverage_start,
  s.coverage_end,
  s.next_due_date,
  s.daily_rate,
  
  -- Overall validation
  CASE 
    WHEN s.coverage_end IS NULL 
      AND (SELECT COUNT(*) FROM payments WHERE student_id = s.id) = 0
    THEN '✅ PASS - No payments, no coverage expected'
    WHEN s.coverage_end IS NULL 
      AND s.status IN ('VACATED', 'CHECKED_OUT')
    THEN '✅ PASS - Inactive student'
    ELSE '❌ FAIL - Has payments but no coverage data'
  END as overall_status

FROM students s
LEFT JOIN rooms r ON r.id = s.room_id
WHERE s.coverage_end IS NULL
  OR s.billing_anchor_date IS NULL
ORDER BY s.status, s.full_name
LIMIT 3;

-- ═══════════════════════════════════════════════════════════════════════════════
-- OVERALL AUDIT SUMMARY
-- ═══════════════════════════════════════════════════════════════════════════════

WITH validation_results AS (
  -- Count full payment validations
  SELECT 
    COUNT(*) FILTER (
      WHERE ABS(s.daily_rate - ROUND(r.rent_per_bed / 30.0, 2)) < 0.01
        AND p.days_covered = ROUND(p.amount / s.daily_rate)
        AND s.billing_anchor_date = p.payment_date
        AND s.coverage_end = (p.payment_date + p.days_covered - 1)::date
        AND p.days_covered BETWEEN 29 AND 31
    ) as full_payment_pass,
    
    COUNT(*) FILTER (
      WHERE ABS(p.amount - r.rent_per_bed) < 5
    ) as full_payment_total
    
  FROM students s
  INNER JOIN rooms r ON r.id = s.room_id
  INNER JOIN LATERAL (
    SELECT * FROM payments WHERE student_id = s.id ORDER BY payment_date DESC LIMIT 1
  ) p ON TRUE
  WHERE s.status = 'ACTIVE' AND s.coverage_end IS NOT NULL
    AND ABS(p.amount - r.rent_per_bed) < 5
)
SELECT 
  '═══════════════════════════════════════════════════' as separator,
  'PHASE 1 VALIDATION AUDIT SUMMARY' as title,
  '═══════════════════════════════════════════════════' as separator2
UNION ALL
SELECT 
  'Total Active Students:',
  COUNT(*)::text,
  ''
FROM students WHERE status = 'ACTIVE'
UNION ALL
SELECT 
  'Students with Coverage Data:',
  COUNT(*)::text || ' (' || ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM students WHERE status = 'ACTIVE'), 0), 1)::text || '%)',
  ''
FROM students 
WHERE status = 'ACTIVE' AND coverage_end IS NOT NULL
UNION ALL
SELECT 
  'Students with Payments:',
  COUNT(DISTINCT student_id)::text,
  ''
FROM payments
UNION ALL
SELECT 
  '═══════════════════════════════════════════════════',
  'VALIDATION RESULTS',
  '═══════════════════════════════════════════════════'
UNION ALL
SELECT 
  '✅ Full Payment Validations:',
  full_payment_pass::text || ' / ' || full_payment_total::text,
  CASE WHEN full_payment_pass = full_payment_total THEN '✅ PASS' ELSE '❌ FAIL' END
FROM validation_results;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DECISION GATE
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- ✅ PROCEED TO PHASE 2 IF:
-- - All validation categories show "✅ PASS" in overall_status
-- - No "❌ FAIL" results in any validation
-- - Audit summary shows all checks passing
-- - All coverage calculations match expected values
--
-- ❌ DO NOT PROCEED IF:
-- - Any validation shows "❌ FAIL"
-- - Discrepancies exist in any calculation
-- - daily_rate ≠ monthly_rent / 30
-- - days_covered ≠ ROUND(amount / daily_rate)
-- - coverage_end ≠ payment_date + days_covered - 1
-- - billing_anchor_date ≠ payment_date
--
-- ═══════════════════════════════════════════════════════════════════════════════
