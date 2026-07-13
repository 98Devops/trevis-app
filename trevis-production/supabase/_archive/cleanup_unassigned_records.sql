-- ═══════════════════════════════════════════════════════════
-- SPRINT 5: Clean up UNASSIGNED student records
-- This script removes UNASSIGNED placeholder records from the database
-- ═══════════════════════════════════════════════════════════

-- First, let's see what UNASSIGNED records exist
SELECT 
  id, 
  full_name, 
  room_id,
  status,
  created_at
FROM students 
WHERE full_name LIKE 'UNASSIGNED%' 
ORDER BY full_name;

-- Count UNASSIGNED records
SELECT 
  COUNT(*) as unassigned_count,
  status
FROM students 
WHERE full_name LIKE 'UNASSIGNED%'
GROUP BY status;

-- UNCOMMENT THE LINES BELOW TO DELETE UNASSIGNED RECORDS
-- WARNING: This will permanently delete UNASSIGNED records from the database

/*
-- Delete UNASSIGNED records
DELETE FROM students 
WHERE full_name LIKE 'UNASSIGNED%';

-- Verify deletion
SELECT 
  COUNT(*) as remaining_unassigned_count
FROM students 
WHERE full_name LIKE 'UNASSIGNED%';
*/

-- Alternative: Update UNASSIGNED records to VACANT status instead of deleting
-- This preserves the bed capacity tracking

/*
UPDATE students 
SET 
  status = 'VACANT',
  full_name = '— Vacant —',
  phone = NULL,
  national_id = NULL,
  emergency_contact_name = NULL,
  emergency_contact_phone = NULL,
  notes = 'Converted from UNASSIGNED record',
  updated_at = now()
WHERE full_name LIKE 'UNASSIGNED%';
*/

-- Check room capacity after cleanup
SELECT 
  p.name as property_name,
  r.room_number,
  r.bed_capacity,
  COUNT(s.id) as current_students,
  (r.bed_capacity - COUNT(s.id)) as available_beds
FROM properties p
JOIN rooms r ON r.property_id = p.id
LEFT JOIN students s ON s.room_id = r.id AND s.status NOT IN ('VACANT', 'VACATED')
GROUP BY p.name, r.room_number, r.bed_capacity
ORDER BY p.name, r.room_number;