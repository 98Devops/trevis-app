-- ═══════════════════════════════════════════════════════════
-- R6 — PERFORMANCE INDEXES (safe, additive, reversible)
--
-- Targets the app's actual hot query patterns (audited from src/services/*).
-- Indexes are ADDITIVE: they only speed up reads, never change data, never
-- affect permissions/RLS, and are trivially reversible (DROP INDEX). This is the
-- safe kind of DB change — the opposite of the function-permission work.
--
-- `IF NOT EXISTS` makes this idempotent (safe to re-run).
-- ═══════════════════════════════════════════════════════════

-- ── 1) THE hot one: payments by student, ordered by date. ──
-- Runs on every coverage rebuild/replay, payment-history view, and breakdown
-- (coverageDatabaseService, paymentService, coverageRepairService). The engine
-- replays this constantly. Composite (student_id, payment_date) serves both the
-- filter AND the ORDER BY from the index.
CREATE INDEX IF NOT EXISTS idx_payments_student_date
  ON public.payments (student_id, payment_date);

-- ── 2) Students by room + status (rent-edit fan-out, room aggregation). ──
-- propertyService.rebuildRoomCoverage + room metrics: WHERE room_id=? AND status='ACTIVE'.
CREATE INDEX IF NOT EXISTS idx_students_room_status
  ON public.students (room_id, status);

-- ── 3) Students by status (portfolio fetch + R2/repair scans). ──
-- getAllStudentsCoverage (status != 'VACATED'), R2/repair (status='ACTIVE').
CREATE INDEX IF NOT EXISTS idx_students_status
  ON public.students (status);

-- ── 4) Student transfers by student (transfer history view). ──
CREATE INDEX IF NOT EXISTS idx_student_transfers_student
  ON public.student_transfers (student_id);

-- ── 5) Rooms by property (property detail / build). ──
CREATE INDEX IF NOT EXISTS idx_rooms_property
  ON public.rooms (property_id);

-- ═══════════════════════════════════════════════════════════
-- VERIFY (read-only): list the indexes we just ensured exist.
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE schemaname='public'
--   AND indexname IN ('idx_payments_student_date','idx_students_room_status',
--     'idx_students_status','idx_student_transfers_student','idx_rooms_property')
-- ORDER BY tablename, indexname;
--
-- ROLLBACK (if ever needed — also harmless):
-- DROP INDEX IF EXISTS public.idx_payments_student_date;  -- etc.
-- ═══════════════════════════════════════════════════════════
