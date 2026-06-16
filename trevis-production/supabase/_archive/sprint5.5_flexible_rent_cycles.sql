-- ⛔ RETIRED / QUARANTINED 2026-06-16 — DO NOT RUN. See supabase/_archive/README.md.
-- Defines a SECOND coverage engine (calculate_coverage, FLOOR) whose STEP 6/7 DO blocks
-- AUTO-EXECUTE and overwrite student coverage. The only writer is JS
-- rebuildStudentCoverage(); bulk re-derive via scripts/replay_portfolio_coverage.mjs.
-- ═══════════════════════════════════════════════════════════
-- SPRINT 5.5: FLEXIBLE RENT CYCLE ENGINE
-- Fundamental billing model redesign from calendar month to coverage periods
-- ═══════════════════════════════════════════════════════════

-- STEP 1: Add coverage tracking to payments table
-- This tracks what period each payment covers
ALTER TABLE payments 
  ADD COLUMN IF NOT EXISTS coverage_start_date date,
  ADD COLUMN IF NOT EXISTS coverage_end_date date,
  ADD COLUMN IF NOT EXISTS days_covered integer;

-- STEP 2: Add coverage tracking to students table
-- This tracks current coverage status for each student
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS coverage_start date,
  ADD COLUMN IF NOT EXISTS coverage_end date,
  ADD COLUMN IF NOT EXISTS daily_rate numeric(10,2);

-- STEP 3: Create function to calculate coverage from payment
-- This is the core business logic for the flexible billing system
CREATE OR REPLACE FUNCTION calculate_coverage(
  p_room_rent numeric,
  p_payment_amount numeric,
  p_payment_date date
) RETURNS TABLE (
  daily_rate numeric,
  days_covered integer,
  coverage_start date,
  coverage_end date
) AS $$
BEGIN
  -- Calculate daily rate (monthly rent / 30)
  daily_rate := ROUND(p_room_rent / 30.0, 2);
  
  -- Calculate days covered (floor of payment / daily rate)
  days_covered := FLOOR(p_payment_amount / daily_rate)::integer;
  
  -- Coverage starts on payment date
  coverage_start := p_payment_date;
  
  -- Coverage ends after days_covered days
  coverage_end := p_payment_date + (days_covered || ' days')::interval - '1 day'::interval;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- STEP 4: Create function to get student status based on coverage
CREATE OR REPLACE FUNCTION get_student_status(
  p_coverage_end date
) RETURNS text AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_days_diff integer;
BEGIN
  -- If no coverage end date, return VACANT
  IF p_coverage_end IS NULL THEN
    RETURN 'VACANT';
  END IF;
  
  v_days_diff := p_coverage_end - v_today;
  
  -- Status logic based on days remaining
  IF v_days_diff > 7 THEN
    RETURN 'PAID';  -- Current, more than 7 days remaining
  ELSIF v_days_diff >= 1 AND v_days_diff <= 7 THEN
    RETURN 'EXPIRING_SOON';  -- 1-7 days remaining
  ELSIF v_days_diff = 0 THEN
    RETURN 'DUE_TODAY';  -- Due today
  ELSE
    RETURN 'OVERDUE';  -- Coverage expired
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- STEP 5: Create function to calculate days remaining or overdue
CREATE OR REPLACE FUNCTION get_days_status(
  p_coverage_end date
) RETURNS TABLE (
  days_count integer,
  status_label text
) AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_days_diff integer;
BEGIN
  -- If no coverage end date, return NULL
  IF p_coverage_end IS NULL THEN
    days_count := NULL;
    status_label := NULL;
    RETURN NEXT;
    RETURN;
  END IF;
  
  v_days_diff := p_coverage_end - v_today;
  
  IF v_days_diff >= 0 THEN
    days_count := v_days_diff;
    status_label := days_count || ' days remaining';
  ELSE
    days_count := ABS(v_days_diff);
    status_label := days_count || ' days overdue';
  END IF;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- STEP 6: Backfill existing payments with coverage data
-- This updates historical payments to use the new coverage model
DO $$
DECLARE
  v_payment RECORD;
  v_room RECORD;
  v_coverage RECORD;
BEGIN
  -- Loop through all payments that don't have coverage dates
  FOR v_payment IN 
    SELECT p.id, p.student_id, p.amount, p.payment_date, p.payment_method
    FROM payments p
    WHERE p.coverage_start_date IS NULL
    ORDER BY p.payment_date ASC
  LOOP
    -- Get room rent for this student
    SELECT r.rent_per_bed INTO v_room
    FROM students s
    JOIN rooms r ON s.room_id = r.id
    WHERE s.id = v_payment.student_id;
    
    -- Skip if no room found
    IF v_room.rent_per_bed IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Calculate coverage for this payment
    SELECT * INTO v_coverage
    FROM calculate_coverage(v_room.rent_per_bed, v_payment.amount, v_payment.payment_date);
    
    -- Update payment with coverage data
    UPDATE payments
    SET 
      coverage_start_date = v_coverage.coverage_start,
      coverage_end_date = v_coverage.coverage_end,
      days_covered = v_coverage.days_covered
    WHERE id = v_payment.id;
  END LOOP;
END $$;

-- STEP 7: Update students table with current coverage
-- This sets each student's current coverage based on their latest payment
DO $$
DECLARE
  v_student RECORD;
  v_latest_payment RECORD;
  v_room RECORD;
BEGIN
  -- Loop through all active students
  FOR v_student IN 
    SELECT s.id, s.room_id, s.status
    FROM students s
    WHERE s.status NOT IN ('VACATED', 'SUSPENDED')
  LOOP
    -- Get latest payment for this student
    SELECT p.*
    INTO v_latest_payment
    FROM payments p
    WHERE p.student_id = v_student.id
    ORDER BY p.payment_date DESC, p.created_at DESC
    LIMIT 1;
    
    -- Get room rent
    SELECT r.rent_per_bed INTO v_room
    FROM rooms r
    WHERE r.id = v_student.room_id;
    
    -- Update student with coverage data
    IF v_latest_payment.id IS NOT NULL AND v_room.rent_per_bed IS NOT NULL THEN
      UPDATE students
      SET 
        coverage_start = v_latest_payment.coverage_start_date,
        coverage_end = v_latest_payment.coverage_end_date,
        daily_rate = ROUND(v_room.rent_per_bed / 30.0, 2)
      WHERE id = v_student.id;
    END IF;
  END LOOP;
END $$;

-- STEP 8: Create view for operational dashboard
-- This provides real-time status of all students
CREATE OR REPLACE VIEW student_coverage_status AS
SELECT 
  s.id,
  s.full_name as name,
  p.name as property_name,
  r.room_number as room_no,
  r.rent_per_bed as monthly_rent,
  s.daily_rate,
  s.coverage_start,
  s.coverage_end,
  get_student_status(s.coverage_end) as status,
  (SELECT status_label FROM get_days_status(s.coverage_end)) as days_status,
  (SELECT days_count FROM get_days_status(s.coverage_end)) as days_count,
  CASE 
    WHEN s.coverage_end IS NOT NULL AND s.coverage_end >= CURRENT_DATE THEN
      ROUND(s.daily_rate * (s.coverage_end - CURRENT_DATE + 1), 2)
    ELSE 0
  END as coverage_value_remaining,
  CASE
    WHEN s.coverage_end IS NOT NULL AND s.coverage_end < CURRENT_DATE THEN
      ROUND(s.daily_rate * (CURRENT_DATE - s.coverage_end), 2)
    ELSE 0
  END as amount_overdue
FROM students s
JOIN rooms r ON s.room_id = r.id
JOIN properties p ON r.property_id = p.id
WHERE s.status NOT IN ('VACATED', 'SUSPENDED');

-- STEP 9: Create function to get dashboard KPIs
CREATE OR REPLACE FUNCTION get_dashboard_kpis()
RETURNS TABLE (
  total_students integer,
  current_students integer,
  expiring_soon integer,
  overdue_students integer,
  total_overdue_amount numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::integer as total_students,
    COUNT(CASE WHEN status = 'PAID' THEN 1 END)::integer as current_students,
    COUNT(CASE WHEN status = 'EXPIRING_SOON' THEN 1 END)::integer as expiring_soon,
    COUNT(CASE WHEN status IN ('OVERDUE', 'DUE_TODAY') THEN 1 END)::integer as overdue_students,
    COALESCE(SUM(CASE WHEN status IN ('OVERDUE', 'DUE_TODAY') THEN amount_overdue ELSE 0 END), 0) as total_overdue_amount
  FROM student_coverage_status;
END;
$$ LANGUAGE plpgsql STABLE;

-- STEP 10: Add comments for documentation
COMMENT ON COLUMN payments.coverage_start_date IS 'Start date of period covered by this payment';
COMMENT ON COLUMN payments.coverage_end_date IS 'End date of period covered by this payment';
COMMENT ON COLUMN payments.days_covered IS 'Number of days covered by this payment';
COMMENT ON COLUMN students.coverage_start IS 'Start date of current coverage period';
COMMENT ON COLUMN students.coverage_end IS 'End date of current coverage period';
COMMENT ON COLUMN students.daily_rate IS 'Daily rate calculated from room rent (rent/30)';

COMMENT ON FUNCTION calculate_coverage IS 'Calculates coverage period from payment amount and room rent';
COMMENT ON FUNCTION get_student_status IS 'Returns student status based on coverage end date';
COMMENT ON FUNCTION get_days_status IS 'Returns days remaining or overdue with label';
COMMENT ON VIEW student_coverage_status IS 'Real-time operational view of student coverage status';
COMMENT ON FUNCTION get_dashboard_kpis IS 'Returns dashboard KPIs based on coverage status';

-- ═══════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ═══════════════════════════════════════════════════════════
