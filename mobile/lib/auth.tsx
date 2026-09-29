import * as Linking from 'expo-linking';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getSupabase, supabase, supabaseConfigured } from '@/lib/supabase';
import { deleteAccountCloud } from '@/lib/backend';
import { unregisterRealXPushTokenForCurrentUser } from '@/lib/realxPush';

type AuthResult = { error?: string; confirmationRequired?: boolean };
type AuthValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  recoveryMode: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>;
  sendReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  updateEmail: (email: string) => Promise<AuthResult>;
  refreshSession: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<AuthResult>;
  clearRecovery: () => void;
};

const noConfig = async (): Promise<AuthResult> => ({ error: 'Authentication is not configured for this build.' });
const AuthContext = createContext<AuthValue>({
  session: null, user: null, loading: true, isGuest: true, recoveryMode: false,
  signIn: noConfig, signUp: noConfig, sendReset: noConfig, updatePassword: noConfig,
  updateEmail: noConfig, refreshSession: noConfig, signOut: async () => {},
  deleteAccount: noConfig, clearRecovery: () => {},
});

function authError(error: unknown): string {
  return error instanceof Error ? error.message : 'The authentication request failed. Please try again.';
}

function redirectUrl() {
  return Linking.createURL('auth');
}

async function handleAuthUrl(url: string, setRecoveryMode: (value: boolean) => void) {
  const client = getSupabase();
  const parsed = Linking.parse(url);
  const query = parsed.queryParams ?? {};
  const fragment = url.includes('#') ? new URLSearchParams(url.slice(url.indexOf('#') + 1)) : null;
  const value = (name: string) => {
    const queryValue = query[name];
    if (typeof queryValue === 'string') return queryValue;
    return fragment?.get(name) ?? undefined;
  };
  const errorDescription = value('error_description');
  if (errorDescription) throw new Error(decodeURIComponent(errorDescription.replaceAll('+', ' ')));

  const code = value('code');
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } else {
    const tokenHash = value('token_hash');
    const type = value('type');
    if (tokenHash && type) {
      const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
      if (error) throw error;
    } else {
      const accessToken = value('access_token');
      const refreshToken = value('refresh_token');
      if (accessToken && refreshToken) {
        const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) throw error;
      }
    }
  }
  if (value('type') === 'recovery') setRecoveryMode(true);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      if (event === 'SIGNED_OUT') setRecoveryMode(false);
    });

    const onUrl = (url: string) => {
      void handleAuthUrl(url, setRecoveryMode).catch(() => {});
    };
    const linkSubscription = Linking.addEventListener('url', ({ url }) => onUrl(url));

    void (async () => {
      try {
        const [{ data }, initialUrl] = await Promise.all([
          supabase.auth.getSession(),
          Linking.getInitialURL(),
        ]);
        if (!active) return;
        setSession(data.session);
        if (initialUrl) await handleAuthUrl(initialUrl, setRecoveryMode);
      } catch {
        // Keep the app usable in guest mode when Auth is temporarily unreachable.
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      subscription.unsubscribe();
      linkSubscription.remove();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
      return error ? { error: error.message } : {};
    } catch (error) { return { error: authError(error) }; }
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string): Promise<AuthResult> => {
    try {
      const { data, error } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() }, emailRedirectTo: redirectUrl() },
      });
      return error ? { error: error.message } : { confirmationRequired: !data.session };
    } catch (error) { return { error: authError(error) }; }
  }, []);

  const sendReset = useCallback(async (email: string): Promise<AuthResult> => {
    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl() });
      return error ? { error: error.message } : {};
    } catch (error) { return { error: authError(error) }; }
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    try {
      const { error } = await getSupabase().auth.updateUser({ password });
      return error ? { error: error.message } : {};
    } catch (error) { return { error: authError(error) }; }
  }, []);

  const updateEmail = useCallback(async (email: string): Promise<AuthResult> => {
    try {
      const { error } = await getSupabase().auth.updateUser({ email: email.trim() });
      return error ? { error: error.message } : {};
    } catch (error) { return { error: authError(error) }; }
  }, []);

  const refreshSession = useCallback(async (): Promise<AuthResult> => {
    try {
      const { error } = await getSupabase().auth.refreshSession();
      return error ? { error: error.message } : {};
    } catch (error) { return { error: authError(error) }; }
  }, []);

  const signOut = useCallback(async () => {
    setRecoveryMode(false);
    await unregisterRealXPushTokenForCurrentUser();
    try { await getSupabase().auth.signOut(); } catch {}
  }, []);

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    try {
      await deleteAccountCloud();
      await getSupabase().auth.signOut({ scope: 'local' });
      setRecoveryMode(false);
      return {};
    } catch (error) { return { error: authError(error) }; }
  }, []);

  const value = useMemo<AuthValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    isGuest: !session?.user,
    recoveryMode,
    signIn,
    signUp,
    sendReset,
    updatePassword,
    updateEmail,
    refreshSession,
    signOut,
    deleteAccount,
    clearRecovery: () => setRecoveryMode(false),
  }), [session, loading, recoveryMode, signIn, signUp, sendReset, updatePassword, updateEmail, refreshSession, signOut, deleteAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
