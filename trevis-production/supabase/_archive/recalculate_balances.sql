-- Recalculate Student Balances Function
-- This function recalculates all student balances and statuses
-- Call this after payment updates/deletes to keep everything in sync
-- CRITICAL: Must target ALL student statuses (not just ACTIVE) because
-- edit/delete payment can change a PAID student back to OVERDUE

DROP FUNCTION IF EXISTS recalculate_student_balances();

CREATE OR REPLACE FUNCTION recalculate_student_balances()
RETURNS integer AS $$
DECLARE
  cnt integer := 0;
  stud RECORD;
  total_paid numeric;
  room_rent numeric;
  new_status text;
  current_month date := DATE_TRUNC('month', CURRENT_DATE)::date;
BEGIN
  -- Loop through ALL students that should be tracked
  -- Including PAID, PARTIAL, OVERDUE — not just ACTIVE
  FOR stud IN
    SELECT s.id, s.room_id, r.rent_per_bed
    FROM students s
    JOIN rooms r ON r.id = s.room_id
    WHERE s.status IN ('ACTIVE', 'PAID', 'PARTIAL', 'OVERDUE')
      AND r.is_active = true
  LOOP
    -- Get total payments for current month
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM payments p
    WHERE p.student_id = stud.id
      AND DATE_TRUNC('month', p.payment_date) = current_month;
    
    -- Determine status
    room_rent := stud.rent_per_bed;
    IF total_paid >= room_rent THEN
      new_status := 'PAID';
    ELSIF total_paid > 0 THEN
      new_status := 'PARTIAL';
    ELSE
      new_status := 'OVERDUE';
    END IF;
    
    -- Update student status (keep ACTIVE as the canonical status, use obligations for payment status)
    -- Note: We keep student status as ACTIVE so the UI can always find them
    -- Payment status is tracked via monthly_obligations
    
    -- Update or create monthly obligation for current month
    INSERT INTO monthly_obligations (student_id, month, amount_due, amount_paid, status)
    VALUES (
      stud.id, 
      current_month, 
      room_rent, 
      total_paid, 
      new_status
    )
    ON CONFLICT (student_id, month) 
    DO UPDATE SET 
      amount_paid = EXCLUDED.amount_paid,
      status = EXCLUDED.status,
      updated_at = NOW();
    
    cnt := cnt + 1;
  END LOOP;
  
  RETURN cnt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to auto-recalculate when payments change
CREATE OR REPLACE FUNCTION trigger_recalculate_balances()
RETURNS trigger AS $$
BEGIN
  -- Recalculate balances after any payment change
  PERFORM recalculate_student_balances();
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS payments_recalculate_trigger ON payments;

-- Create trigger on payments table
CREATE TRIGGER payments_recalculate_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_recalculate_balances();