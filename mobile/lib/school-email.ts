import { getSupabase } from './supabase';

export const SCHOOL_EMAIL_MESSAGE = 'Use an email domain enabled by Kouponly. Rajagiri students can use @rajagiri.edu.in.';

export async function assertAllowedStudentEmail(email: string) {
  const { data, error } = await getSupabase().rpc('kouponly_school_email', { p_email: email.trim().toLowerCase() });
  if (error) throw error;
  if (data !== true) throw new Error(SCHOOL_EMAIL_MESSAGE);
}
