-- ═══════════════════════════════════════════════════════════
-- R4 — SECURITY HARDENING (Supabase linter remediation)
-- Perimeter hardening for hand-over: shrink the unauthenticated attack surface,
-- pin function search_path, fix an over-permissive RLS policy, drop backup cruft.
--
-- SAFETY: based on a verified audit of what the APP actually calls (authenticated
-- role only, never anon). Each REVOKE below is checked against src/ RPC usage.
-- Run in a transaction; review the verification queries at the bottom.
--
-- WHAT THE APP CALLS (must keep EXECUTE for `authenticated`):
--   save_monthly_snapshot, generate_monthly_obligations,
--   recalculate_student_balances, recalculate_all_balances, get_my_profile,
--   execute_student_transfer
-- INTERNAL / trigger / RLS-helper only (revoke from BOTH anon + authenticated):
--   handle_new_user, create_obligation_for_new_student, update_monthly_obligation,
--   trigger_recalculate_balances, is_admin, my_property_id, rls_auto_enable,
--   and the retired coverage stubs.
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1) Shrink the unauthenticated attack surface.
--    The app never calls RPCs as `anon` (only after login). Revoke anon EXECUTE
--    on EVERYTHING in public — this directly closes the "hit /rest/v1/rpc/... via
--    a shared link without signing in" hole (lint 0028).
-- ─────────────────────────────────────────────────────────────
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
-- Stop future functions from auto-granting EXECUTE to anon.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- ─────────────────────────────────────────────────────────────
-- 2) For SIGNED-IN users, revoke EXECUTE on functions the client never calls
--    directly (triggers / RLS helpers / retired stubs). Keeps least privilege
--    without touching the 6 RPCs the app legitimately uses (lint 0029).
-- ─────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                     FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_obligation_for_new_student()   FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_monthly_obligation()           FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_recalculate_balances()        FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin()                            FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.my_property_id()                      FROM authenticated;
-- rls_auto_enable: admin/maintenance only, never from the client.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()                     FROM authenticated, anon;

-- Retired coverage stubs — no one should call these (they only RAISE). Belt + braces.
REVOKE EXECUTE ON FUNCTION public.calculate_coverage(numeric, numeric, date)        FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.populate_rent_cycle_fields()                       FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.rebuild_student_coverage_from_payments(uuid)       FROM authenticated, anon;

-- ─────────────────────────────────────────────────────────────
-- 3) Pin search_path on every public function (lint 0011). Prevents a function
--    from resolving objects via an attacker-influenced search_path. Generated
--    dynamically so it covers all signatures without hand-listing each.
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp',
      r.proname, r.args
    );
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 4) Fix the over-permissive profiles INSERT policy (lint 0024:
--    WITH CHECK (true) lets anyone insert a profile row). Restrict inserts to
--    admins (profiles are normally created by the handle_new_user trigger).
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin can insert profiles" ON public.profiles;
CREATE POLICY "Admin can insert profiles"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 5) student_transfers has RLS enabled but no policy (lint 0008) → currently
--    unreadable by the client. The app reads transfer history; allow authenticated
--    SELECT. (Writes happen via the SECURITY DEFINER execute_student_transfer.)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can read transfers" ON public.student_transfers;
CREATE POLICY "Authenticated can read transfers"
  ON public.student_transfers
  FOR SELECT
  TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────
-- 6) Drop the coverage backup tables — their job is done (repairs verified,
--    drift = 0). Removes the RLS-no-policy INFO findings and stale PII copies.
--    (Comment these out if you want to keep a backup a while longer.)
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.students_coverage_backup_20260616;
DROP TABLE IF EXISTS public.students_coverage_backup_20260618;

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- VERIFICATION (run after COMMIT)
-- ═══════════════════════════════════════════════════════════
-- (a) anon should have EXECUTE on NOTHING in public → expect 0 rows:
-- SELECT p.proname
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname='public'
--   AND has_function_privilege('anon', p.oid, 'EXECUTE');
--
-- (b) the 6 app RPCs should still be executable by authenticated → expect 6 rows:
-- SELECT p.proname
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname='public'
--   AND p.proname IN ('save_monthly_snapshot','generate_monthly_obligations',
--     'recalculate_student_balances','recalculate_all_balances','get_my_profile',
--     'execute_student_transfer')
--   AND has_function_privilege('authenticated', p.oid, 'EXECUTE');
--
-- (c) functions missing a pinned search_path → expect 0 rows:
-- SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
-- WHERE n.nspname='public'
--   AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,'{}')) c
--                   WHERE c LIKE 'search_path=%');
-- ═══════════════════════════════════════════════════════════

-- ── MANUAL (Supabase dashboard, no SQL) ──
-- Auth → Providers/Policies → enable "Leaked password protection"
--   (HaveIBeenPwned check) — lint auth_leaked_password_protection.
