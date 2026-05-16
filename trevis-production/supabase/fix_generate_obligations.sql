-- Fix Generate Obligations Function
-- Run this to fix the constraint error
-- Uses 'OVERDUE' status instead of 'PENDING' which violates the check constraint

-- Drop and recreate the function with correct status
DROP FUNCTION IF EXISTS generate_monthly_obligations(date);

CREATE OR REPLACE FUNCTION generate_monthly_obligations(p_month date)
RETURNS integer AS $$
DECLARE
  cnt integer := 0;
  stud RECORD;
BEGIN
  FOR stud IN
    SELECT s.id as student_id, r.rent_per_bed as amount_due
    FROM students s
    JOIN rooms r ON r.id = s.room_id
    WHERE s.status IN ('ACTIVE', 'PAID', 'PARTIAL', 'OVERDUE')
      AND r.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM monthly_obligations mo
        WHERE mo.student_id = s.id AND mo.month = p_month
      )
  LOOP
    INSERT INTO monthly_obligations (student_id, month, amount_due, amount_paid, status)
    VALUES (stud.student_id, p_month, stud.amount_due, 0, 'OVERDUE');
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;