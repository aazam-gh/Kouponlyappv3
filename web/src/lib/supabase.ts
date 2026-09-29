import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim() || 'http://127.0.0.1:54321';
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)?.trim() || 'missing-public-key';
export const supabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && key !== 'missing-public-key');
export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export function requireSupabaseConfig() {
  if (!supabaseConfigured) {
    throw new Error('Set VITE_SUPABASE_URL and a VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY in web/.env.local.');
  }
}
