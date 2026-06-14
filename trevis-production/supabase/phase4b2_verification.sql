-- PHASE 4B.2 PAYMENT FLOW VERIFICATION QUERIES
-- Run these to verify payment flow updates coverage fields correctly

-- 1. Check "Student Test" current state (should have NULL coverage fields from old payments)
SELECT 
    id, 
    full_name, 
    status,
    coverage_start, 
    coverage_end, 
    next_due_date, 
    daily_rate,
    (SELECT COUNT(*) FROM payments WHERE student_id = students.id) as payment_count
FROM students 
WHERE full_name = 'Student Test';

-- Expected BEFORE fix test:
-- coverage_start: NULL
-- coverage_end: NULL
-- next_due_date: NULL
-- daily_rate: NULL
-- payment_count: 1 (the $130 payment exists but didn't update coverage)


-- 2. After recording a NEW payment via UI, check if coverage fields update
-- (Record a $130 payment for "Student Test" with today's date, then run this)
SELECT 
    id, 
    full_name, 
    status,
    coverage_start, 
    coverage_end, 
    next_due_date, 
    daily_rate,
    CASE 
        WHEN coverage_end IS NULL THEN 'NO COVERAGE'
        WHEN coverage_end >= CURRENT_DATE + INTERVAL '7 days' THEN 'CURRENT'
        WHEN coverage_end >= CURRENT_DATE THEN 'EXPIRING_SOON'
        ELSE 'OVERDUE'
    END as classification
FROM students 
WHERE full_name = 'Student Test';

-- Expected AFTER recording new payment:
-- coverage_start: Today's date
-- coverage_end: Today + 26 days (for $130 at $5/day rent)
-- next_due_date: coverage_end + 1
-- daily_rate: 5.0
-- classification: 'CURRENT'


-- 3. Check the most recent payment record includes coverage metadata
SELECT 
    p.id,
    p.student_id,
    s.full_name,
    p.amount,
    p.payment_date,
    p.coverage_start_date,
    p.coverage_end_date,
    p.days_covered,
    p.created_at
FROM payments p
JOIN students s ON p.student_id = s.id
WHERE s.full_name = 'Student Test'
ORDER BY p.created_at DESC
LIMIT 1;

-- Expected for new payment:
-- coverage_start_date: Today's date
-- coverage_end_date: Today + 26 days
-- days_covered: 26


-- 4. Verify early payment extension logic
-- Find a student with future coverage, record payment, verify extension
SELECT 
    id,
    full_name,
    coverage_start,
    coverage_end,
    next_due_date,
    CASE 
        WHEN coverage_end >= CURRENT_DATE THEN 
            (coverage_end - CURRENT_DATE) || ' days remaining'
        ELSE 
            (CURRENT_DATE - coverage_end) || ' days overdue'
    END as coverage_status
FROM students
WHERE full_name = 'Talent Nyikadzino';  -- Has coverage until 2025-01-29

-- After recording early payment (before coverage_end), verify:
-- New coverage_start = old coverage_end + 1
-- Prepaid days preserved


-- 5. Portfolio-wide coverage field health check
SELECT 
    COUNT(*) as total_active,
    COUNT(coverage_end) as has_coverage_end,
    COUNT(*) - COUNT(coverage_end) as missing_coverage_end,
    COUNT(daily_rate) as has_daily_rate,
    COUNT(next_due_date) as has_next_due_date
FROM students
WHERE status = 'ACTIVE';

-- Healthy system after fix:
-- All ACTIVE students with payments should have coverage_end
-- Missing coverage = students who haven't paid yet


-- 6. Identify students with payments but no coverage (orphaned records)
SELECT 
    s.id,
    s.full_name,
    s.coverage_end,
    s.daily_rate,
    COUNT(p.id) as payment_count,
    SUM(p.amount) as total_paid
FROM students s
JOIN payments p ON p.student_id = s.id
WHERE s.status = 'ACTIVE'
    AND s.coverage_end IS NULL
GROUP BY s.id, s.full_name, s.coverage_end, s.daily_rate;

-- Expected BEFORE fix: "Student Test" appears here
-- Expected AFTER fix and re-payment: Empty result (all paid students have coverage)


-- 7. Room 8 aggregation verification (Student Test's room)
SELECT 
    r.id as room_id,
    r.room_number,
    r.rent_per_bed,
    COUNT(s.id) FILTER (WHERE s.status = 'ACTIVE') as active_students,
    COUNT(s.id) FILTER (WHERE s.status = 'ACTIVE' AND s.coverage_end IS NOT NULL) as students_with_coverage,
    COUNT(s.id) FILTER (WHERE s.status = 'ACTIVE' AND s.coverage_end >= CURRENT_DATE + INTERVAL '7 days') as current_count,
    COUNT(s.id) FILTER (WHERE s.status = 'ACTIVE' AND s.coverage_end < CURRENT_DATE) as overdue_count
FROM rooms r
LEFT JOIN students s ON s.room_id = r.id
WHERE r.room_number = 'Room 8'
GROUP BY r.id, r.room_number, r.rent_per_bed;

-- Expected BEFORE fix:
-- active_students: 1
-- students_with_coverage: 0
-- current_count: 0
-- overdue_count: 1

-- Expected AFTER fix and re-payment:
-- active_students: 1
-- students_with_coverage: 1
-- current_count: 1
-- overdue_count: 0
