-- Run in Supabase SQL editor
-- Use this query to ensure the profiles exist and are set to ADMIN.
-- This will insert a row if it doesn't exist, or update it if it does.

INSERT INTO profiles (id, email, role)
SELECT 
  au.id,
  au.email,
  'ADMIN'
FROM auth.users au
WHERE au.email IN ('tfrsuperfx@gmail.com', 'tafiejr6@gmail.com')
ON CONFLICT (id) DO UPDATE 
SET role = 'ADMIN', email = EXCLUDED.email;

-- Verify the rows:
-- SELECT email, role FROM profiles WHERE email IN ('tfrsuperfx@gmail.com', 'tafiejr6@gmail.com');
