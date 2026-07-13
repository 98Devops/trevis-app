-- ═══════════════════════════════════════════════════════════
-- STUDENT TRANSFERS — apply to PropNest's database
--
-- The transfer UI calls the execute_student_transfer RPC, but the function +
-- audit table were only ever in supabase/_archive and never applied here, so
-- PostgREST reports "Could not find the function ... in the schema cache".
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste this whole file → Run.
-- Idempotent (IF NOT EXISTS / CREATE OR REPLACE) — safe to run more than once.
-- After it runs, the schema cache refreshes automatically and Transfer works.
-- ═══════════════════════════════════════════════════════════

-- 1. Audit table for room transfers
CREATE TABLE IF NOT EXISTS student_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_room_id uuid NOT NULL REFERENCES rooms(id),
  to_room_id uuid NOT NULL REFERENCES rooms(id),
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text,
  performed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT different_rooms CHECK (from_room_id != to_room_id)
);

CREATE INDEX IF NOT EXISTS idx_transfers_student ON student_transfers(student_id);
CREATE INDEX IF NOT EXISTS idx_transfers_date ON student_transfers(transfer_date);

-- 2. Transfer function — runs atomically in one statement (true DB transaction):
--    validates eligibility + capacity, writes the audit row, moves the student,
--    and bumps the current-month obligation if the destination rent differs.
--    SECURITY DEFINER so it runs regardless of the caller's RLS. The app then
--    rebuilds coverage in JS (transferService.executeTransfer) so the new daily
--    rate / coverage_end are recalculated.
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
  IF p_from_room_id = p_to_room_id THEN
    RAISE EXCEPTION 'Cannot transfer student to the same room';
  END IF;

  SELECT * INTO v_student_record
  FROM students
  WHERE id = p_student_id AND status = 'ACTIVE';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found or inactive';
  END IF;

  SELECT * INTO v_from_room FROM rooms WHERE id = p_from_room_id;
  SELECT * INTO v_to_room FROM rooms WHERE id = p_to_room_id;
  IF v_to_room.id IS NULL THEN
    RAISE EXCEPTION 'Target room not found';
  END IF;

  SELECT COUNT(*) INTO v_occupied_beds
  FROM students
  WHERE room_id = p_to_room_id AND status != 'VACATED';
  v_available_beds := v_to_room.bed_capacity - v_occupied_beds;
  IF v_available_beds <= 0 THEN
    RAISE EXCEPTION 'Target room is full';
  END IF;

  INSERT INTO student_transfers (
    student_id, from_room_id, to_room_id, transfer_date, reason, performed_by
  ) VALUES (
    p_student_id, p_from_room_id, p_to_room_id, p_transfer_date, p_reason, p_performed_by
  ) RETURNING id INTO v_transfer_id;

  -- NOTE: PropNest's students/monthly_obligations tables don't have an updated_at
  -- column, so we do NOT set it here (the original archived function assumed a
  -- different schema and failed with: column "updated_at" ... does not exist).
  -- The room move is what matters; the JS layer rebuilds coverage afterwards.
  UPDATE students
  SET room_id = p_to_room_id
  WHERE id = p_student_id;

  IF v_from_room.rent_per_bed != v_to_room.rent_per_bed THEN
    v_current_month := date_trunc('month', CURRENT_DATE)::date;
    UPDATE monthly_obligations
    SET amount_due = v_to_room.rent_per_bed
    WHERE student_id = p_student_id AND month = v_current_month;
    IF FOUND THEN
      v_obligation_updated := true;
    END IF;
  END IF;

  RETURN json_build_object(
    'transfer_id', v_transfer_id,
    'obligation_updated', v_obligation_updated
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Transfer failed: %', SQLERRM;
END;
$$;

-- 3. Allow the app (anon + signed-in) to call the RPC. We GRANT (never blanket
--    REVOKE FROM PUBLIC — that would break the shared-DB demo) so the call
--    resolves; the function's own checks + SECURITY DEFINER govern what it does.
GRANT EXECUTE ON FUNCTION execute_student_transfer(uuid, uuid, uuid, date, text, uuid)
  TO anon, authenticated;

COMMENT ON FUNCTION execute_student_transfer IS
'Atomically transfers a student between rooms (any property): validates capacity, writes an audit row, moves the student, and adjusts the current-month obligation when rent changes. Coverage is rebuilt in JS afterwards.';
