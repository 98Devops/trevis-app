import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // PKCE returns the OAuth result as a ?code= query param instead of a
        // #hash fragment. The new shell uses hash-based navigation, which can
        // clobber a #access_token fragment before the client reads it — PKCE
        // avoids that entirely. detectSessionInUrl exchanges the code on load.
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
