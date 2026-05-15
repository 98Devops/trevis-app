-- Setup trevisdaradi@gmail.com as ADMIN
-- Run this after the user has signed up via the app

-- First, ensure the email is in the allowed list
INSERT INTO settings (key, value) 
VALUES ('allowed_emails', '["tfrsuperfx@gmail.com","tafiejr6@gmail.com","trevisdaradi@gmail.com"]')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Set the user as ADMIN (run this after trevisdaradi@gmail.com has signed up)
-- This will create or update the profile
INSERT INTO profiles (id, email, role, full_name)
SELECT 
  au.id, 
  au.email, 
  'ADMIN' as role,
  COALESCE(au.raw_user_meta_data->>'full_name', 'Trevis Daradi') as full_name
FROM auth.users au
WHERE au.email = 'trevisdaradi@gmail.com'
ON CONFLICT (id) DO UPDATE 
  SET role = 'ADMIN', 
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name;

-- Verify the setup
SELECT 
  p.id,
  p.email,
  p.role,
  p.full_name,
  p.created_at
FROM profiles p
WHERE p.email = 'trevisdaradi@gmail.com';
