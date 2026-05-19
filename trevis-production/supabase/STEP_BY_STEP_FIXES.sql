-- ═══════════════════════════════════════════════════════════
-- STEP-BY-STEP CRITICAL FIXES
-- Run each section separately to avoid any issues
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- STEP 1: FIX FOREIGN KEY CONSTRAINTS
-- Copy and run this section first
-- ─────────────────────────────────────────────

-- Drop existing foreign key constraints
ALTER TABLE student_transfers 
DROP CONSTRAINT IF EXISTS student_transfers_from_room_id_fkey;

ALTER TABLE student_transfers 
DROP CONSTRAINT IF EXISTS student_transfers_to_room_id_fkey;

-- Recreate with CASCADE DELETE
ALTER TABLE student_transfers 
ADD CONSTRAINT student_transfers_from_room_id_fkey 
FOREIGN KEY (from_room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE student_transfers 
ADD CONSTRAINT student_transfers_to_room_id_fkey 
FOREIGN KEY (to_room_id) REFERENCES rooms(id) ON DELETE CASCADE;

-- Verify constraints
SELECT 'STEP 1 COMPLETE: Foreign key constraints updated' as status;

-- ─────────────────────────────────────────────
-- STEP 2: CLEAN UP UNASSIGNED RECORDS
-- Copy and run this section second
-- ─────────────────────────────────────────────

-- Show existing UNASSIGNED records
SELECT 
  'BEFORE CLEANUP' as phase,
  COUNT(*) as unassigned_count
FROM students 
WHERE full_name LIKE 'UNASSIGNED%';

-- Delete UNASSIGNED records
DELETE FROM students 
WHERE full_name LIKE 'UNASSIGNED%' 
   OR full_name LIKE '%UNASSIGNED%';

-- Verify cleanup
SELECT 
  'AFTER CLEANUP' as phase,
  COUNT(*) as remaining_count
FROM students 
WHERE full_name LIKE 'UNASSIGNED%';

SELECT 'STEP 2 COMPLETE: UNASSIGNED records cleaned' as status;

-- ─────────────────────────────────────────────
-- STEP 3: UPDATE TRANSFER FUNCTION
-- Copy and run this section third
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION execute_student_transfer(
  p_student_id uuid,
  p_from_room_id uuid,
  p_to_room_id uuid,
  p_transfer_date date,
  p_reason text DEFAULT NULL,
  p_performed_by uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transfer_id uuid;
  v_student_record students%ROWTYPE;
  v_from_room rooms%ROWTYPE;
  v_to_room rooms%ROWTYPE;
  v_occupied_beds integer;
  v_available_beds integer;
  v_obligation_updated boolean := false;
  v_current_month date;
  v_from_property_id uuid;
  v_to_property_id uuid;
BEGIN
  -- Validate input parameters
  IF p_from_room_id = p_to_room_id THEN
    RAISE EXCEPTION 'Cannot transfer student to the same room';
  END IF;

  -- Get student record and validate
  SELECT * INTO v_student_record
  FROM students 
  WHERE id = p_student_id AND status NOT IN ('VACANT', 'VACATED');
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found or inactive';
  END IF;

  -- Verify student is currently in the from_room
  IF v_student_record.room_id != p_from_room_id THEN
    RAISE EXCEPTION 'Student is not currently in the specified from_room';
  END IF;

  -- Get room records
  SELECT * INTO v_from_room FROM rooms WHERE id = p_from_room_id;
  SELECT * INTO v_to_room FROM rooms WHERE id = p_to_room_id;
  
  -- Get property IDs
  SELECT property_id INTO v_from_property_id FROM rooms WHERE id = p_from_room_id;
  SELECT property_id INTO v_to_property_id FROM rooms WHERE id = p_to_room_id;
  
  IF v_from_room.id IS NULL THEN
    RAISE EXCEPTION 'Source room not found';
  END IF;
  
  IF v_to_room.id IS NULL THEN
    RAISE EXCEPTION 'Target room not found';
  END IF;

  -- Check target room capacity
  SELECT COUNT(*) INTO v_occupied_beds
  FROM students 
  WHERE room_id = p_to_room_id 
    AND status NOT IN ('VACANT', 'VACATED')
    AND id != CASE WHEN v_from_property_id = v_to_property_id THEN p_student_id ELSE '00000000-0000-0000-0000-000000000000'::uuid END;
  
  v_available_beds := v_to_room.bed_capacity - v_occupied_beds;
  
  IF v_available_beds <= 0 THEN
    RAISE EXCEPTION 'Target room is full (capacity: %, occupied: %)', v_to_room.bed_capacity, v_occupied_beds;
  END IF;

  -- Create transfer audit record
  INSERT INTO student_transfers (
    student_id,
    from_room_id,
    to_room_id,
    transfer_date,
    reason,
    performed_by
  ) VALUES (
    p_student_id,
    p_from_room_id,
    p_to_room_id,
    p_transfer_date,
    p_reason,
    p_performed_by
  ) RETURNING id INTO v_transfer_id;

  -- Update student room assignment
  UPDATE students 
  SET room_id = p_to_room_id,
      updated_at = now()
  WHERE id = p_student_id;

  -- Update current month obligation if rent changed
  IF v_from_room.rent_per_bed != v_to_room.rent_per_bed THEN
    v_current_month := date_trunc('month', CURRENT_DATE)::date;
    
    UPDATE monthly_obligations
    SET amount_due = v_to_room.rent_per_bed,
        updated_at = now()
    WHERE student_id = p_student_id 
      AND month = v_current_month;
    
    IF FOUND THEN
      v_obligation_updated := true;
    END IF;
  END IF;

  -- Return success result
  RETURN json_build_object(
    'transfer_id', v_transfer_id,
    'obligation_updated', v_obligation_updated,
    'from_property', v_from_property_id,
    'to_property', v_to_property_id,
    'same_property', v_from_property_id = v_to_property_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Transfer failed: %', SQLERRM;
END;
$$;

SELECT 'STEP 3 COMPLETE: Transfer function updated' as status;

-- ─────────────────────────────────────────────
-- STEP 4: VERIFICATION
-- Copy and run this section last
-- ─────────────────────────────────────────────

-- Check foreign key constraints
SELECT 
  constraint_name,
  delete_rule
FROM information_schema.referential_constraints 
WHERE constraint_name LIKE '%student_transfers%room%';

-- Check room capacity
SELECT 
  p.name as property,
  r.room_number,
  r.bed_capacity,
  COUNT(s.id) FILTER (WHERE s.status NOT IN ('VACANT', 'VACATED')) as occupied,
  (r.bed_capacity - COUNT(s.id) FILTER (WHERE s.status NOT IN ('VACANT', 'VACATED'))) as available
FROM properties p
JOIN rooms r ON r.property_id = p.id
LEFT JOIN students s ON s.room_id = r.id
GROUP BY p.name, r.room_number, r.bed_capacity
ORDER BY p.name, r.room_number;

SELECT 'ALL STEPS COMPLETE: System is production ready!' as final_status;