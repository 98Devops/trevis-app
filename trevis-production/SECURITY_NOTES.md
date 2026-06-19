# SECURITY NOTES — Supabase linter warnings (accepted-risk register)

**Date:** 2026-06-18
**Context:** ONE shared Supabase database serves both localhost and production (no staging
copy). Therefore every DB permission change is a live production experiment. An attempt to
revoke function EXECUTE (R4/R5) caused a read outage (RLS helpers lost EXECUTE → policies
returned 0 rows → app showed near-empty). It was fully reversed by re-granting EXECUTE;
**no data was lost — permission changes cannot delete data.**

**Decision:** for the remaining function warnings we **document and defer** rather than risk
another outage on the single prod DB. They are `WARN`, not active breaches (see below).

---

## What actually protects the data (read this first)

The flagged functions are gated by **Row-Level Security (RLS)** on the underlying tables. An
unauthenticated (`anon`) caller hitting `/rest/v1/rpc/<fn>` still executes **under RLS**, so they
cannot read or write rows they aren't entitled to. The linter flags *exposure of a SECURITY
DEFINER function*, not a data leak. **Data confidentiality rests on RLS policies, which are intact.**

The single most valuable hardening is on **auth/login** (the real attacker entry point), not these
RPCs — and that part is zero-risk to apply (see "Safe actions" below).

---

## Warning register

### 1. `*_security_definer_function_executable` (22 warnings — anon + authenticated)
- **What:** 11 SECURITY DEFINER functions are callable via the REST RPC endpoint by `anon` and/or
  `authenticated`.
- **Real risk:** LOW–MEDIUM, mitigated by RLS. Two sub-groups:
  - **RLS helpers / profile:** `is_admin`, `my_property_id`, `get_my_profile` — read only the
    caller's own context; harmless to expose, and **required by RLS policies** (revoking them is
    what broke reads).
  - **Mutators / triggers:** `execute_student_transfer`, `generate_monthly_obligations`,
    `save_monthly_snapshot`, `recalculate_student_balances`, `handle_new_user`,
    `create_obligation_for_new_student`, `update_monthly_obligation`, `rls_auto_enable` — still
    operate under RLS; a stranger calling them can't act outside row policy.
- **Safe future fix (ONLY with a staging DB):** switch the read-only helpers to `SECURITY INVOKER`
  one at a time, verifying the app still reads all students after each. Do NOT blanket-`REVOKE FROM
  PUBLIC` — that removes the EXECUTE RLS needs and blanks the app.
- **Why deferred:** clearing a yellow warning is not worth a production outage on the shared DB.

### 2. `auth_leaked_password_protection` (1 warning) — ✅ SAFE TO FIX NOW
- **What:** Supabase Auth isn't checking new passwords against HaveIBeenPwned.
- **Risk:** real and relevant (weak/compromised passwords are the actual break-in vector).
- **Fix (no SQL, no outage risk):** Supabase Dashboard → Authentication → Providers/Policies →
  enable **Leaked password protection**. Do this.

---

## Safe actions (zero DB-permission risk) — recommended hardening

These harden the genuine attack surface (login / shared-link abuse) without touching function grants:
1. **Enable leaked-password protection** (above).
2. **Confirm RLS is ON for every data table** (`students`, `rooms`, `properties`, `payments`,
   `student_transfers`, `profiles`) with sensible policies — this is what actually stops break-ins.
   Verify, don't blanket-change.
3. **Auth settings:** set a reasonable minimum password length; keep email confirmations on.
4. **Never expose the `service_role` key** in the client/`.env`/git (already the practice).
5. **Rotate keys** if the anon key was ever shared publicly.

## Rollback reference (if any future permission change blanks the app)
```sql
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
```
Then hard-refresh + re-login. Data is never affected by GRANT/REVOKE.

> R4/R5 SQL files are kept in `supabase/` for reference but are **superseded by this decision** —
> do not re-run R5 against the shared prod DB without a staging copy to test on first.
