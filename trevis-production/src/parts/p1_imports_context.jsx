import { useState, useCallback, useEffect, createContext, useContext } from "react";
import { supabase, isConfigured } from "../lib/supabase";
import { signIn, signOut, getCurrentUser } from "../services/authService";
import { getProperties, addRoom as addRoomSvc } from "../services/propertyService";
import { addStudent as addStudentSvc, removeStudent as removeStudentSvc, getDataFlags } from "../services/studentService";
import { recordPayment as recordPaymentSvc, getPaymentsByStudent } from "../services/paymentService";
import { debug, debugTime, debugTimeEnd } from "../lib/debug.js";
import { withRetry } from "../lib/withRetry.js";

/* ═══════════════════════════════════════════════════════════
   AUTH CONTEXT
═══════════════════════════════════════════════════════════ */
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }

    let cancelled = false;

    const loadProfile = async () => {
      try {
        debug('[PropNest] Loading user profile...');
        
        // Staff allow-list — only these accounts may enter the UI shell.
        // (RLS is the real data guard; this keeps the shell staff-only and
        // blocks random Google sign-ups.) To add a staff member: add their
        // exact login email here, rebuild, and redeploy.
        //
        // DEMO MODE: build with VITE_DEMO_MODE=open (the public PropNest demo,
        // pointed at the demo database of generated tenants) and the gate is
        // skipped — anyone may Google-sign-in and look around. NEVER set this
        // on a build pointed at the production database.
        const OPEN_DEMO = String(import.meta.env.VITE_DEMO_MODE || "").toLowerCase() === "open";
        const ALLOWED_EMAILS = [
          "admin@propnest.app",     // demo
          "manager@propnest.app",   // demo
          "tfrsuperfx@gmail.com",   // owner / dev
          "trevisdaradi@gmail.com", // Trevis (owner, ADMIN)
          "daradit@africau.edu",    // Trevis (university email)
        ];

        const { data: { session } } = await supabase.auth.getSession();

        if (session && !OPEN_DEMO) {
          const email = session.user.email;
          if (!ALLOWED_EMAILS.includes(email)) {
            await supabase.auth.signOut();
            setAuthError("Access denied. This system is restricted to authorised staff only.");
            if (!cancelled) { setUser(null); setLoading(false); }
            return;
          }
        }
        
        const { data } = await getCurrentUser();
        debug('[PropNest] Profile:', data ? `${data.email} (${data.role})` : 'none');
        if (!cancelled) { setUser(data); setLoading(false); }
      } catch (err) {
        console.error('[PropNest] Profile load error:', err);
        if (!cancelled) { setUser(null); setLoading(false); }
      }
    };

    // Check for existing session on mount
    loadProfile();

    // Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      debug('[PropNest] Auth event:', event);
      if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Reload profile when user signs in
        loadProfile();
      }
    });

    // Safety timeout
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('[PropNest] Auth timed out');
        setLoading(false);
      }
    }, 5000);

    return () => { cancelled = true; clearTimeout(timeout); subscription.unsubscribe(); };
  }, []);

  const login = async (email, password) => {
    try {
      debug('[PropNest] Signing in:', email);
      const { data, error } = await signIn(email, password);
      if (error) {
        console.error('[PropNest] Sign in error:', error);
        return { data: null, error };
      }
      // signIn returns merged user+profile — set it directly
      debug('[PropNest] Sign in success:', data?.email, data?.role);
      if (data) setUser(data);
      return { data, error: null };
    } catch (err) {
      console.error('[PropNest] Sign in exception:', err);
      return { data: null, error: { message: err.message || 'Sign in failed' } };
    }
  };

  const logout = async () => {
    try { await signOut(); } catch (_) {}
    setUser(null);
    setAuthError("");
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading, isConfigured, authError, setAuthError }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ═══════════════════════════════════════════════════════════
   DATA CONTEXT — loads from Supabase after auth
═══════════════════════════════════════════════════════════ */
const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    const timerId = `getProperties-${Date.now()}`;
    setLoading(true);
    try {
      debugTime(`[Perf] ${timerId}`);
      debug('[PropNest] Fetching properties...');
      // Retry transient failures (network blip) so the dashboard self-heals
      // instead of flashing an error on first load. Read-only — safe to retry.
      const { data, error: err } = await withRetry(() => getProperties());
      debugTimeEnd(`[Perf] ${timerId}`);
      debug('[PropNest] Properties:', data?.length, 'error:', err?.message);
      if (err) { setError(err.message); }
      else { setProperties(data || []); setError(null); }
    } catch (err) {
      console.error('[PropNest] Properties fetch error:', err);
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }
    if (user) { refresh(); }
    else { setProperties([]); setLoading(false); }
  }, [user, refresh]);

  return (
    <DataContext.Provider value={{ properties, loading, error, refresh, setProperties }}>
      {children}
    </DataContext.Provider>
  );
}

export { isConfigured, signIn, signOut, getProperties, addRoomSvc, addStudentSvc, removeStudentSvc, recordPaymentSvc, getPaymentsByStudent, getDataFlags };

// Export removeRoom from propertyService
export { removeRoom } from "../services/propertyService";

// Export payment edit/delete functions
export { updatePayment, deletePayment } from "../services/paymentService";

/* ═══════════════════════════════════════════════════════════
   ADDITIONAL SERVICE FUNCTIONS (Sprint 3)
═══════════════════════════════════════════════════════════ */
export async function saveMonthlySnapshot(monthDate) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  const { data, error } = await supabase.rpc('save_monthly_snapshot', { p_month: monthDate });
  return { data, error };
}

export async function getSnapshots() {
  if (!isConfigured) return { data: [], error: null };
  const { data, error } = await supabase.from('monthly_snapshots').select('*, properties(name)').order('snapshot_month', { ascending: false });
  return { data: data || [], error };
}

export async function generateObligations(monthDate) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  const { data, error } = await supabase.rpc('generate_monthly_obligations', { p_month: monthDate });
  return { data, error };
}

export async function recalculateBalances() {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  const { data, error } = await supabase.rpc('recalculate_student_balances');
  return { data, error };
}

export async function getSettings() {
  if (!isConfigured) return { data: {}, error: null };
  const { data, error } = await supabase.from('settings').select('*');
  const obj = {};
  (data || []).forEach(s => { obj[s.key] = s.value; });
  return { data: obj, error };
}

export async function updateSetting(key, value) {
  if (!isConfigured) return { error: { message: 'Not configured' } };
  const { error } = await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
  return { error };
}

// (removed) updateStudent: an unguarded students-table write with no field
// allow-list and no coverage rebuild. All callers use the rebuild-aware
// studentService.updateStudent / paymentService.updateStudentField instead.

export async function logReport(userId, reportMonth, reportType) {
  if (!isConfigured) return { error: null };
  const { error } = await supabase.from('report_logs').insert({ generated_by: userId, report_month: reportMonth, report_type: reportType });
  return { error };
}

export async function updateRoomNotes(roomId, notes) {
  if (!isConfigured) return { error: { message: 'Not configured' } };
  const { error } = await supabase.from('rooms').update({ notes }).eq('id', roomId);
  return { error };
}

