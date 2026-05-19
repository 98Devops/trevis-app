-- ═══════════════════════════════════════════════════════════
-- SPRINT 5 FIX: Add updated_at column to students table
-- This column is required for inline editing functionality
-- ═══════════════════════════════════════════════════════════

-- Add updated_at column if it doesn't exist
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create index for updated_at queries
CREATE INDEX IF NOT EXISTS idx_students_updated_at 
ON students(updated_at);

-- Add comment
COMMENT ON COLUMN students.updated_at IS 
'Timestamp of last update to student record. Used for audit trails and sync.';

-- Verify column was added
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'students' 
      AND column_name = 'updated_at'
    ) 
    THEN '✅ updated_at column added successfully'
    ELSE '❌ updated_at column missing'
  END as status;
