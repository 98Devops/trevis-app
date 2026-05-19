-- ═══════════════════════════════════════════════════════════
-- SPRINT 5 SQL VERIFICATION SCRIPT
-- Run this in Supabase SQL Editor to check if Sprint 5 scripts are needed
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. CHECK IF STUDENT_TRANSFERS TABLE EXISTS
-- ─────────────────────────────────────────────
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'student_transfers' 
      AND table_schema = 'public'
    ) 
    THEN '✅ student_transfers table EXISTS'
    ELSE '❌ student_transfers table MISSING - Run sprint5_student_transfers.sql'
  END as student_transfers_status;

-- ─────────────────────────────────────────────
-- 2. CHECK IF EXECUTE_STUDENT_TRANSFER FUNCTION EXISTS
-- ─────────────────────────────────────────────
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'execute_student_transfer' 
      AND routine_schema = 'public'
    ) 
    THEN '✅ execute_student_transfer function EXISTS'
    ELSE '❌ execute_student_transfer function MISSING - Run sprint5_student_transfers.sql'
  END as transfer_function_status;

-- ─────────────────────────────────────────────
-- 3. CHECK SPRINT 5 PERFORMANCE INDEXES
-- ─────────────────────────────────────────────
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE indexname = 'idx_payments_student_month'
    ) 
    THEN '✅ Sprint 5 performance indexes EXIST'
    ELSE '❌ Sprint 5 performance indexes MISSING - Run sprint5_performance_indexes.sql'
  END as performance_indexes_status;

-- ─────────────────────────────────────────────
-- 4. DETAILED INDEX CHECK
-- ─────────────────────────────────────────────
SELECT 
  'Sprint 5 Indexes Status:' as title,
  COUNT(*) as total_sprint5_indexes
FROM pg_indexes 
WHERE indexname IN (
  'idx_payments_student_month',
  'idx_payments_date', 
  'idx_payments_method',
  'idx_students_room_status',
  'idx_students_status',
  'idx_students_checkin',
  'idx_obligations_student_month_status',
  'idx_obligations_status',
  'idx_obligations_month',
  'idx_rooms_property_active',
  'idx_transfers_student',
  'idx_transfers_date'
);

-- Expected: 12 indexes total (10 performance + 2 transfer indexes)

-- ─────────────────────────────────────────────
-- 5. SUMMARY REPORT
-- ─────────────────────────────────────────────
SELECT 
  '🎯 SPRINT 5 READINESS CHECK' as summary,
  CASE 
    WHEN (
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_transfers') AND
      EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'execute_student_transfer') AND
      (SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE 'idx_payments_student_month') > 0
    )
    THEN '✅ READY - All Sprint 5 database components are installed'
    ELSE '❌ NOT READY - Run the required SQL scripts listed above'
  END as readiness_status;

-- ═══════════════════════════════════════════════════════════
-- INSTRUCTIONS:
-- 
-- If you see ❌ MISSING status for any component:
-- 1. Run sprint5_performance_indexes.sql first
-- 2. Run sprint5_student_transfers.sql second  
-- 3. Re-run this verification script
-- 4. Should see all ✅ EXISTS status
-- 
-- ═══════════════════════════════════════════════════════════