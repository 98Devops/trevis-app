-- ═══════════════════════════════════════════════════════════
-- R5 — REVOKE FUNCTION EXECUTE FROM PUBLIC (finishes R4)
--
-- R4 revoked EXECUTE from `anon`/`authenticated` directly, but these functions
-- still had EXECUTE granted to PUBLIC (the catch-all role anon + authenticated
-- inherit). A REVOKE ... FROM <role> does NOT remove a grant made to PUBLIC, so
-- the linter still flagged them as anon/authenticated-executable.
--
-- FIX: revoke EXECUTE from PUBLIC on all public functions, then GRANT back to
-- `authenticated` ONLY the 6 RPCs the app actually calls. Everything else
-- (triggers, RLS helpers, retired stubs) ends up callable by no client role —
-- triggers still fire because they run as the table owner, and RLS helpers are
-- invoked by the planner, not via the API.
--
-- VERIFIED app RPCs (keep for authenticated): save_monthly_snapshot,
--   generate_monthly_obligations, recalculate_student_balances,
--   recalculate_all_balances, get_my_profile, execute_student_transfer.
--
-- ⚠️ TEST AFTER RUNNING: log in/out, record a payment, do a transfer, open the
--    dashboard. Every change is reversible (re-GRANT) if something needs access.
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- 1) Remove the catch-all PUBLIC grant from every function in public.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Belt + braces: also clear anon (no client RPC is called unauthenticated).
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- 2) Grant back EXECUTE to `authenticated` for ONLY the 6 RPCs the app calls.
GRANT EXECUTE ON FUNCTION public.save_monthly_snapshot(date)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_monthly_obligations(date)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_student_balances()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile()                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_student_transfer(uuid, uuid, uuid, date, text, uuid) TO authenticated;

-- recalculate_all_balances: the app calls it (paymentService). Grant if it exists
-- (signature unknown here — adjust args if the GRANT errors "function does not exist").
DO $$
BEGIN
  BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.recalculate_all_balances() TO authenticated';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'recalculate_all_balances() not found with () signature — grant manually if it exists with args.';
  END;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- VERIFICATION
-- (a) anon executes nothing → expect 0:
-- SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
-- WHERE n.nspname='public' AND has_function_privilege('anon', p.oid, 'EXECUTE');
--
-- (b) authenticated executes ONLY the app RPCs → expect exactly those names:
-- SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
-- WHERE n.nspname='public' AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
-- ORDER BY 1;
-- ═══════════════════════════════════════════════════════════
