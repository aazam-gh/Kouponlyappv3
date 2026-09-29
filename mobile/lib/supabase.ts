import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = (process.env.EXPO_PUBLIC_SUPABASE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)?.trim();

export const supabaseConfigured = Boolean(url && key);

export const supabase = supabaseConfigured
  ? createClient(url!, key!, {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function getSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add the public project URL and publishable key to mobile/.env.local.');
  }
  return supabase;
}

let appStateSubscription: ReturnType<typeof AppState.addEventListener> | undefined;
if (supabase && Platform.OS !== 'web') {
  appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export function disposeSupabaseAppStateListener() {
  appStateSubscription?.remove();
  appStateSubscription = undefined;
}
