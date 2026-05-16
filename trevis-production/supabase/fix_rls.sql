-- TREVIS RLS FIX — Run in Supabase SQL Editor
-- Fixes infinite recursion where policies on profiles query profiles directly.
-- Solution: is_admin() is SECURITY DEFINER so it bypasses RLS.

-- Step 1: Create is_admin() FIRST (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT coalesce(
    (SELECT role = 'ADMIN' FROM profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Step 2: Fix profiles policies — use is_admin() not direct query
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can manage all profiles" ON profiles;

CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admin can manage all profiles" ON profiles
  FOR ALL USING (is_admin());

-- Step 3: Fix payments policies — use is_admin()
DROP POLICY IF EXISTS "Admins can delete payments" ON payments;
DROP POLICY IF EXISTS "Admins can update payments" ON payments;

CREATE POLICY "Admins can delete payments" ON payments
  FOR DELETE USING (is_admin());

CREATE POLICY "Admins can update payments" ON payments
  FOR UPDATE USING (is_admin());
