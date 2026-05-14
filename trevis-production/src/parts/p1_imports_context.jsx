import { useState, useCallback, useEffect, createContext, useContext } from "react";
import { supabase, isConfigured } from "../lib/supabase";
import { signIn, signOut, getCurrentUser } from "../services/authService";
import { getProperties, addRoom as addRoomSvc } from "../services/propertyService";
import { addStudent as addStudentSvc, removeStudent as removeStudentSvc, getDataFlags } from "../services/studentService";
import { recordPayment as recordPaymentSvc, getPaymentsByStudent } from "../services/paymentService";

/* ═══════════════════════════════════════════════════════════
   AUTH CONTEXT
═══════════════════════════════════════════════════════════ */
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }

    let cancelled = false;

    const loadProfile = async () => {
      try {
        console.log('[Trevis] Loading user profile...');
        const { data } = await getCurrentUser();
        console.log('[Trevis] Profile:', data ? `${data.email} (${data.role})` : 'none');
        if (!cancelled) { setUser(data); setLoading(false); }
      } catch (err) {
        console.error('[Trevis] Profile load error:', err);
        if (!cancelled) { setUser(null); setLoading(false); }
      }
    };

    // Check for existing session on mount
    loadProfile();

    // Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Trevis] Auth event:', event);
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
        console.warn('[Trevis] Auth timed out');
        setLoading(false);
      }
    }, 5000);

    return () => { cancelled = true; clearTimeout(timeout); subscription.unsubscribe(); };
  }, []);

  const login = async (email, password) => {
    try {
      console.log('[Trevis] Signing in:', email);
      const { data, error } = await signIn(email, password);
      if (error) {
        console.error('[Trevis] Sign in error:', error);
        return { data: null, error };
      }
      // signIn returns merged user+profile — set it directly
      console.log('[Trevis] Sign in success:', data?.email, data?.role);
      if (data) setUser(data);
      return { data, error: null };
    } catch (err) {
      console.error('[Trevis] Sign in exception:', err);
      return { data: null, error: { message: err.message || 'Sign in failed' } };
    }
  };

  const logout = async () => {
    try { await signOut(); } catch (_) {}
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading, isConfigured }}>
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
    setLoading(true);
    try {
      console.log('[Trevis] Fetching properties...');
      const { data, error: err } = await getProperties();
      console.log('[Trevis] Properties:', data?.length, 'error:', err?.message);
      if (err) { setError(err.message); }
      else { setProperties(data || []); setError(null); }
    } catch (err) {
      console.error('[Trevis] Properties fetch error:', err);
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

export async function updateStudent(studentId, updates) {
  if (!isConfigured) return { error: { message: 'Not configured' } };
  const { error } = await supabase.from('students').update(updates).eq('id', studentId);
  return { error };
}

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

