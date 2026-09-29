import { supabase } from '@/lib/supabase';

// Compatibility handles keep the copied RealX panel components intact while
// routing all data/auth/storage work through Supabase.
export const app = supabase;
export const auth = { client: supabase.auth, currentUser: null };
export const db = supabase;
export const functions = supabase;
export const storage = supabase.storage;
