-- ═══════════════════════════════════════════════════════════
-- TREVIS SPRINT 4 SCHEMA UPDATES
-- Run this file in Supabase SQL Editor BEFORE deploying Sprint 4 code
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. ADD is_active COLUMN TO rooms TABLE
-- ─────────────────────────────────────────────
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_rooms_is_active ON rooms(is_active);

-- ─────────────────────────────────────────────
-- 2. ADD AUDIT COLUMNS TO payments TABLE
-- ─────────────────────────────────────────────
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS updated_at timestamptz,
ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES auth.users(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_payments_updated_at ON payments(updated_at);

-- ─────────────────────────────────────────────
-- 3. CREATE settings TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  value text NOT NULL,
  category text NOT NULL CHECK (category IN ('system', 'auth', 'property', 'notification')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(key, category)
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);

-- ─────────────────────────────────────────────
-- 4. INSERT DEFAULT SETTINGS
-- ─────────────────────────────────────────────
INSERT INTO settings (key, value, category) VALUES
  ('system_name', 'Trevis', 'system'),
  ('currency_symbol', '$', 'system'),
  ('country_phone_code', '+263', 'system'),
  ('allowed_email_1', 'tfrsuperfx@gmail.com', 'auth'),
  ('allowed_email_2', 'tafiejr6@gmail.com', 'auth'),
  ('allowed_email_3', 'trevisdaradi@gmail.com', 'auth')
ON CONFLICT (key, category) DO NOTHING;

-- ─────────────────────────────────────────────
-- 5. RLS POLICIES FOR settings TABLE
-- ─────────────────────────────────────────────
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Admin can read and write all settings
CREATE POLICY "Admin full access to settings" ON settings
  FOR ALL USING (is_admin());

-- Managers can read system settings only
CREATE POLICY "Manager can read system settings" ON settings
  FOR SELECT USING (category = 'system');

-- ─────────────────────────────────────────────
-- 6. HELPER FUNCTION: Get My Profile (RPC)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role text,
  property_id uuid
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.email, p.full_name, p.role, p.property_id
  FROM profiles p
  WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (Run these to verify changes)
-- ═══════════════════════════════════════════════════════════

-- Check rooms.is_active column exists
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'rooms' AND column_name = 'is_active';

-- Check payments audit columns exist
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'payments' AND column_name IN ('updated_at', 'edited_by');

-- Check settings table exists
-- SELECT * FROM settings;

-- ═══════════════════════════════════════════════════════════
-- POST-DEPLOYMENT: SQL TO SET trevisdaradi@gmail.com AS ADMIN
-- Run this AFTER trevisdaradi@gmail.com logs in for the first time
-- ═══════════════════════════════════════════════════════════

-- INSERT INTO profiles (id, email, role)
-- SELECT au.id, au.email, 'ADMIN'
-- FROM auth.users au
-- WHERE au.email = 'trevisdaradi@gmail.com'
-- ON CONFLICT (id) DO UPDATE 
--   SET role = 'ADMIN', email = EXCLUDED.email;
