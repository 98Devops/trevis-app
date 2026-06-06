-- ═══════════════════════════════════════════════════════════
-- SPRINT 5.5: QUICK START - Execute This First
-- ═══════════════════════════════════════════════════════════
-- 
-- Your schema already has most fields! We only need to add:
-- - students.billing_anchor_date
-- - students.next_due_date
-- 
-- Everything else already exists with these names:
-- - students: coverage_start, coverage_end, daily_rate ✅
-- - payments: coverage_start_date, coverage_end_date, days_covered ✅
-- 
-- ═══════════════════════════════════════════════════════════

-- Add only the missing fields
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS billing_anchor_date date;

ALTER TABLE students 
ADD COLUMN IF NOT EXISTS next_due_date date;

-- Add comments
COMMENT ON COLUMN students.billing_anchor_date IS 
'Day of month when student rent is due. Set from payment date.';

COMMENT ON COLUMN students.next_due_date IS 
'Date when next rent payment becomes due.';

-- Verify columns added
SELECT 
  'billing_anchor_date' as column_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'billing_anchor_date'
  ) THEN '✅ Added' ELSE '❌ Missing' END as status
UNION ALL
SELECT 
  'next_due_date',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'next_due_date'
  ) THEN '✅ Added' ELSE '❌ Missing' END;

-- ═══════════════════════════════════════════════════════════
-- DONE! Now run the population function from sprint5.5_rent_cycle_schema.sql
-- Look for: CREATE OR REPLACE FUNCTION populate_rent_cycle_fields()
-- ═══════════════════════════════════════════════════════════
