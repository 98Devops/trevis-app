-- ⚠️ RETIRED (R1) 2026-06-16 — DO NOT RUN THE FUNCTION BELOW.
-- rebuild_student_coverage_from_payments() uses FLOOR(amount/daily_rate) and loses
-- 1 day per payment for non-even daily rates ($110, $260, ...). It has been disabled
-- by supabase/R1_retire_sql_coverage_rebuild.sql. Coverage is written ONLY by the JS
-- engine rebuildStudentCoverage(); historical drift is corrected by the JS portfolio
-- replay (R2 — scripts/replay_portfolio_coverage.mjs). See DATA_TRUTH_AUDIT.md.
-- The STEP 1 diagnostic SELECT below is still useful (read-only).
--
-- PHASE 4B.3 - REPAIR STALE COVERAGE DATA (HISTORICAL — superseded)
--
-- This script repairs students whose coverage was corrupted by the old payment flow
-- (before Phase 4B.3 fix was implemented).
--
-- Run this ONCE after deploying Phase 4B.3 to fix existing data.
-- New payments will be handled correctly by rebuildStudentCoverage().

-- STEP 1: Identify students with stale coverage
-- (Students with coverage_end that doesn't match their payment history)

SELECT 
    s.id,
    s.full_name,
    s.coverage_start,
    s.coverage_end,
    s.daily_rate,
    COUNT(p.id) as payment_count,
    SUM(p.amount) as total_paid,
    r.rent_per_bed
FROM students s
LEFT JOIN payments p ON p.student_id = s.id
LEFT JOIN rooms r ON r.id = s.room_id
WHERE s.status = 'ACTIVE'
GROUP BY s.id, s.full_name, s.coverage_start, s.coverage_end, s.daily_rate, r.rent_per_bed
ORDER BY s.full_name;

-- Expected issue: Students like "Talent Nyikadzino" will show coverage_end 
-- that doesn't match what their payment history should produce.


-- STEP 2: Create a function to rebuild coverage for a single student
-- (This is a SQL version of the JavaScript rebuildStudentCoverage function)

CREATE OR REPLACE FUNCTION rebuild_student_coverage_from_payments(student_uuid UUID)
RETURNS TABLE(
    new_coverage_start DATE,
    new_coverage_end DATE,
    new_daily_rate NUMERIC,
    new_next_due_date DATE
) AS $$
DECLARE
    monthly_rent NUMERIC;
    payment_rec RECORD;
    current_coverage_end DATE := NULL;
    final_coverage_start DATE := NULL;
    final_coverage_end DATE := NULL;
    final_daily_rate NUMERIC := NULL;
    final_next_due_date DATE := NULL;
    payment_start DATE;
    coverage_days INTEGER;
    is_early_payment BOOLEAN;
BEGIN
    -- Get room rent
    SELECT r.rent_per_bed INTO monthly_rent
    FROM students s
    JOIN rooms r ON r.id = s.room_id
    WHERE s.id = student_uuid;

    IF monthly_rent IS NULL THEN
        RAISE EXCEPTION 'Room rent not found for student %', student_uuid;
    END IF;

    -- Calculate daily rate (30-day month)
    final_daily_rate := ROUND(monthly_rent / 30.0, 2);

    -- Loop through all payments in chronological order
    FOR payment_rec IN 
        SELECT id, amount, payment_date
        FROM payments
        WHERE student_id = student_uuid
        ORDER BY payment_date ASC
    LOOP
        -- Calculate coverage days for this payment
        coverage_days := FLOOR(payment_rec.amount / final_daily_rate);

        -- Determine if this is an early payment
        IF current_coverage_end IS NULL THEN
            -- First payment or no existing coverage
            is_early_payment := FALSE;
            payment_start := payment_rec.payment_date;
        ELSIF payment_rec.payment_date <= current_coverage_end THEN
            -- Early payment: extends from existing coverage_end + 1
            is_early_payment := TRUE;
            payment_start := current_coverage_end + INTERVAL '1 day';
        ELSE
            -- Late payment: starts from payment_date
            is_early_payment := FALSE;
            payment_start := payment_rec.payment_date;
        END IF;

        -- Calculate coverage end
        current_coverage_end := payment_start + (coverage_days || ' days')::INTERVAL - INTERVAL '1 day';

        -- Set final coverage start (from first payment)
        IF final_coverage_start IS NULL THEN
            final_coverage_start := payment_start;
        END IF;

        -- Update this payment's metadata
        UPDATE payments
        SET 
            coverage_start_date = payment_start,
            coverage_end_date = current_coverage_end,
            days_covered = coverage_days
        WHERE id = payment_rec.id;
    END LOOP;

    -- If no payments found, return NULLs
    IF current_coverage_end IS NULL THEN
        RETURN QUERY SELECT NULL::DATE, NULL::DATE, NULL::NUMERIC, NULL::DATE;
        RETURN;
    END IF;

    -- Set final values
    final_coverage_end := current_coverage_end;
    final_next_due_date := final_coverage_end + INTERVAL '1 day';

    -- Return result
    RETURN QUERY SELECT 
        final_coverage_start, 
        final_coverage_end, 
        final_daily_rate, 
        final_next_due_date;
END;
$$ LANGUAGE plpgsql;


-- STEP 3: Rebuild coverage for ALL active students

DO $$
DECLARE
    student_rec RECORD;
    coverage_result RECORD;
    students_fixed INTEGER := 0;
BEGIN
    -- Loop through all active students
    FOR student_rec IN 
        SELECT id, full_name 
        FROM students 
        WHERE status = 'ACTIVE'
        ORDER BY full_name
    LOOP
        -- Rebuild coverage from payment history
        SELECT * INTO coverage_result
        FROM rebuild_student_coverage_from_payments(student_rec.id);

        -- Update student coverage fields
        UPDATE students
        SET 
            coverage_start = coverage_result.new_coverage_start,
            coverage_end = coverage_result.new_coverage_end,
            daily_rate = coverage_result.new_daily_rate,
            next_due_date = coverage_result.new_next_due_date
        WHERE id = student_rec.id;

        students_fixed := students_fixed + 1;

        -- Log progress
        RAISE NOTICE 'Fixed: % - coverage_end: %', 
            student_rec.full_name, 
            COALESCE(coverage_result.new_coverage_end::TEXT, 'NULL');
    END LOOP;

    RAISE NOTICE 'Repaired coverage for % students', students_fixed;
END $$;


-- STEP 4: Verify the fix for Talent Nyikadzino

SELECT 
    s.id,
    s.full_name,
    s.coverage_start,
    s.coverage_end,
    s.daily_rate,
    s.next_due_date,
    CASE 
        WHEN s.coverage_end >= CURRENT_DATE + INTERVAL '7 days' THEN 'CURRENT'
        WHEN s.coverage_end >= CURRENT_DATE THEN 'EXPIRING_SOON'
        WHEN s.coverage_end < CURRENT_DATE THEN 'OVERDUE'
        ELSE 'NO_COVERAGE'
    END as status_classification,
    CASE 
        WHEN s.coverage_end >= CURRENT_DATE THEN 
            (s.coverage_end - CURRENT_DATE) || ' days remaining'
        WHEN s.coverage_end < CURRENT_DATE THEN 
            (CURRENT_DATE - s.coverage_end) || ' days overdue'
        ELSE 'No coverage recorded'
    END as display_label
FROM students s
WHERE s.full_name = 'Talent Nyikadzino';

-- Expected result: coverage_end should now match payment history (should be ~9 days from now)


-- STEP 5: Verify payment metadata was updated

SELECT 
    p.id,
    p.amount,
    p.payment_date,
    p.coverage_start_date,
    p.coverage_end_date,
    p.days_covered,
    p.created_at
FROM payments p
JOIN students s ON s.id = p.student_id
WHERE s.full_name = 'Talent Nyikadzino'
ORDER BY p.payment_date ASC;

-- Expected: All payments should have coverage_start_date, coverage_end_date, days_covered populated


-- STEP 6: Portfolio-wide verification

SELECT 
    COUNT(*) as total_active_students,
    COUNT(coverage_end) as students_with_coverage,
    COUNT(*) - COUNT(coverage_end) as students_without_coverage,
    COUNT(CASE WHEN coverage_end >= CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as current_students,
    COUNT(CASE WHEN coverage_end >= CURRENT_DATE AND coverage_end < CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as expiring_soon,
    COUNT(CASE WHEN coverage_end < CURRENT_DATE THEN 1 END) as overdue_students
FROM students
WHERE status = 'ACTIVE';


-- STEP 7: Clean up the temporary function (optional - keep it for future manual repairs)

-- DROP FUNCTION IF EXISTS rebuild_student_coverage_from_payments(UUID);


-- NOTES:
-- 1. This script is IDEMPOTENT - safe to run multiple times
-- 2. The rebuild_student_coverage_from_payments() function implements the same logic as 
--    the JavaScript rebuildStudentCoverage() function
-- 3. After running this, all students will have coverage that matches their payment history
-- 4. Future payments will be handled automatically by the JavaScript code
-- 5. If you need to repair a single student manually, use:
--    SELECT * FROM rebuild_student_coverage_from_payments('student-uuid-here');
--    Then UPDATE students SET ... WHERE id = 'student-uuid-here';
