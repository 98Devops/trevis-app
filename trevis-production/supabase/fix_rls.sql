-- TREVIS RLS FIX — Run in Supabase SQL Editor
-- Fixes circular dependency where is_admin() queries profiles
-- but profiles RLS calls is_admin()

-- Step 1: Drop problematic policies on profiles
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can manage all profiles" ON profiles;

-- Step 2: Recreate without circular is_admin() call
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admin can manage all profiles" ON profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

-- Step 3: Make is_admin() robust with SECURITY DEFINER (bypasses RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT coalesce(
    (SELECT role = 'ADMIN' FROM profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Step 4: Add delete policy for payments (Admins only)
DROP POLICY IF EXISTS "Admins can delete payments" ON payments;

CREATE POLICY "Admins can delete payments" ON payments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'ADMIN'
    )
  );

-- Step 5: Ensure admins can also update payments
DROP POLICY IF EXISTS "Admins can update payments" ON payments;

CREATE POLICY "Admins can update payments" ON payments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'ADMIN'
    )
  );
