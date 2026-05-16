-- ══════════════════════════════════════════════════════════════
-- TREVIS SPRINT 4 — ALL DATABASE FIXES IN ONE FILE
-- Run this in Supabase SQL Editor in one go
-- ══════════════════════════════════════════════════════════════

-- ── 1. FIX RLS POLICIES ────────────────────────────────────

-- Fix circular dependency in profiles RLS
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can manage all profiles" ON profiles;

CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admin can manage all profiles" ON profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT coalesce(
    (SELECT role = 'ADMIN' FROM profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Payment delete policy
DROP POLICY IF EXISTS "Admins can delete payments" ON payments;
CREATE POLICY "Admins can delete payments" ON payments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'ADMIN'
    )
  );

-- Payment update policy
DROP POLICY IF EXISTS "Admins can update payments" ON payments;
CREATE POLICY "Admins can update payments" ON payments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'ADMIN'
    )
  );

-- ── 2. FIX GENERATE OBLIGATIONS ────────────────────────────

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

-- ── 3. FIX RECALCULATE BALANCES ────────────────────────────

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
  FOR stud IN
    SELECT s.id, s.room_id, r.rent_per_bed
    FROM students s
    JOIN rooms r ON r.id = s.room_id
    WHERE s.status IN ('ACTIVE', 'PAID', 'PARTIAL', 'OVERDUE')
      AND r.is_active = true
  LOOP
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM payments p
    WHERE p.student_id = stud.id
      AND DATE_TRUNC('month', p.payment_date) = current_month;
    
    room_rent := stud.rent_per_bed;
    IF total_paid >= room_rent THEN
      new_status := 'PAID';
    ELSIF total_paid > 0 THEN
      new_status := 'PARTIAL';
    ELSE
      new_status := 'OVERDUE';
    END IF;
    
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

-- ── 4. FIX TRIGGER ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_recalculate_balances()
RETURNS trigger AS $$
BEGIN
  PERFORM recalculate_student_balances();
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payments_recalculate_trigger ON payments;

CREATE TRIGGER payments_recalculate_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_recalculate_balances();

-- ══════════════════════════════════════════════════════════════
-- DONE — All fixes applied. Test the following:
-- 1. Delete a payment → student should become OVERDUE
-- 2. Edit a payment amount → status should recalculate
-- 3. Generate obligations → should succeed without constraint error
-- ══════════════════════════════════════════════════════════════
