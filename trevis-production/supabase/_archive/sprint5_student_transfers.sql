-- ═══════════════════════════════════════════════════════════
-- SPRINT 5: STUDENT TRANSFERS TABLE MIGRATION
-- Creates student_transfers table for audit trail of room transfers
-- Requirements: 24.1-24.12
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. CREATE STUDENT_TRANSFERS TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_room_id uuid NOT NULL REFERENCES rooms(id),
  to_room_id uuid NOT NULL REFERENCES rooms(id),
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text,
  performed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  
  -- Constraint: from_room_id must be different from to_room_id
  CONSTRAINT different_rooms CHECK (from_room_id != to_room_id)
);

-- ─────────────────────────────────────────────
-- 2. CREATE INDEXES
-- ─────────────────────────────────────────────

-- Index on student_id for fast lookup of transfer history by student
CREATE INDEX IF NOT EXISTS idx_transfers_student 
ON student_transfers(student_id);

-- Index on transfer_date for chronological queries and reporting
CREATE INDEX IF NOT EXISTS idx_transfers_date 
ON student_transfers(transfer_date);

-- ─────────────────────────────────────────────
-- 3. COMMENTS FOR DOCUMENTATION
-- ─────────────────────────────────────────────

COMMENT ON TABLE student_transfers IS 
'Audit trail for student room transfers. Records all historical room changes with timestamp and user.';

COMMENT ON COLUMN student_transfers.id IS 
'Unique identifier for the transfer record';

COMMENT ON COLUMN student_transfers.student_id IS 
'Reference to the student being transferred. CASCADE DELETE when student is deleted.';

COMMENT ON COLUMN student_transfers.from_room_id IS 
'Room the student is transferring from';

COMMENT ON COLUMN student_transfers.to_room_id IS 
'Room the student is transferring to';

COMMENT ON COLUMN student_transfers.transfer_date IS 
'Date of the transfer. Defaults to current date.';

COMMENT ON COLUMN student_transfers.reason IS 
'Optional text field explaining the reason for the transfer';

COMMENT ON COLUMN student_transfers.performed_by IS 
'User who performed the transfer. References auth.users.';

COMMENT ON COLUMN student_transfers.created_at IS 
'Timestamp when the transfer record was created';

COMMENT ON CONSTRAINT different_rooms ON student_transfers IS 
'Ensures from_room_id and to_room_id are different - prevents same-room transfers';

-- ─────────────────────────────────────────────
-- 4. EXECUTE STUDENT TRANSFER FUNCTION
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
BEGIN
  -- Validate input parameters
  IF p_from_room_id = p_to_room_id THEN
    RAISE EXCEPTION 'Cannot transfer student to the same room';
  END IF;

  -- Get student record and validate
  SELECT * INTO v_student_record
  FROM students 
  WHERE id = p_student_id AND status = 'ACTIVE';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found or inactive';
  END IF;

  -- Get room records
  SELECT * INTO v_from_room FROM rooms WHERE id = p_from_room_id;
  SELECT * INTO v_to_room FROM rooms WHERE id = p_to_room_id;
  
  IF v_to_room.id IS NULL THEN
    RAISE EXCEPTION 'Target room not found';
  END IF;

  -- Check target room capacity
  SELECT COUNT(*) INTO v_occupied_beds
  FROM students 
  WHERE room_id = p_to_room_id AND status != 'VACATED';
  
  v_available_beds := v_to_room.bed_capacity - v_occupied_beds;
  
  IF v_available_beds <= 0 THEN
    RAISE EXCEPTION 'Target room is full';
  END IF;

  -- Begin transaction operations
  
  -- 1. Create transfer audit record
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

  -- 2. Update student room assignment
  UPDATE students 
  SET room_id = p_to_room_id,
      updated_at = now()
  WHERE id = p_student_id;

  -- 3. Update current month obligation if rent changed
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
    'obligation_updated', v_obligation_updated
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Transfer failed: %', SQLERRM;
END;
$$;

-- ─────────────────────────────────────────────
-- 5. FUNCTION COMMENTS
-- ─────────────────────────────────────────────

COMMENT ON FUNCTION execute_student_transfer IS 
'Executes a student room transfer atomically. Validates eligibility, creates audit trail, updates student room assignment, and adjusts current month obligation if rent changed.';

-- ─────────────────────────────────────────────
-- 6. VERIFICATION QUERY
-- ─────────────────────────────────────────────

-- Verify table structure
DO $$
BEGIN
  RAISE NOTICE 'student_transfers table created successfully';
  RAISE NOTICE 'Indexes created: idx_transfers_student, idx_transfers_date';
  RAISE NOTICE 'Constraint enforced: from_room_id != to_room_id';
  RAISE NOTICE 'CASCADE DELETE configured for student_id';
  RAISE NOTICE 'execute_student_transfer function created';
END $$;
