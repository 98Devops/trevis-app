import { supabase, isConfigured } from '../lib/supabase';
import { debug } from '../lib/debug.js';

export async function signIn(email, password) {
  if (!isConfigured) return { data: null, error: { message: 'Supabase not configured' } };
  
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { data: null, error };
  
  // Use RPC function that bypasses RLS to get profile.
  // get_my_profile() RETURNS TABLE, so the RPC yields an array — take row 0.
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_my_profile');
    const profile = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    debug('[PropNest] Profile via RPC:', profile, 'error:', rpcErr);
    if (profile && !rpcErr) {
      return { data: { ...data.user, ...profile }, error: null };
    }
  } catch (err) {
    console.warn('[PropNest] RPC profile failed:', err.message);
  }
  
  // Fallback: try direct query
  try {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
    if (profile) return { data: { ...data.user, ...profile }, error: null };
  } catch (_) {}
  
  return { data: { ...data.user, role: 'MANAGER', full_name: data.user.email }, error: null };
}

export async function signOut() {
  if (!isConfigured) return { error: null };
  return await supabase.auth.signOut();
}

export async function getCurrentUser() {
  if (!isConfigured) return { data: null, error: null };
  
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { data: null, error };
  
  // Use RPC function that bypasses RLS (RETURNS TABLE -> array; take row 0)
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_my_profile');
    const profile = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (profile && !rpcErr) {
      return { data: { ...user, ...profile }, error: null };
    }
  } catch (err) {
    console.warn('[PropNest] RPC getCurrentUser failed:', err.message);
  }
  
  // Fallback
  try {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profile) return { data: { ...user, ...profile }, error: null };
  } catch (_) {}
  
  return { data: { ...user, role: 'MANAGER', full_name: user.email }, error: null };
}

export function onAuthChange(callback) {
  if (!isConfigured) return { data: { subscription: { unsubscribe: () => {} } } };
  return supabase.auth.onAuthStateChange(callback);
}
