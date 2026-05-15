-- ═══════════════════════════════════════════════════════════
-- TREVIS SPRINT 4 — DATABASE MIGRATIONS
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Add is_active column to rooms for soft-delete
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 2. After trevisdaradi@gmail.com logs in via Google for the first time, run:
-- INSERT INTO profiles (id, email, role)
-- SELECT au.id, au.email, 'ADMIN'
-- FROM auth.users au
-- WHERE au.email = 'trevisdaradi@gmail.com'
-- ON CONFLICT (id) DO UPDATE 
-- SET role = 'ADMIN', email = EXCLUDED.email;
