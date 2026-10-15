import * as Linking from 'expo-linking';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getSupabase, supabase, supabaseConfigured } from '@/lib/supabase';
import { deleteAccountCloud } from '@/lib/backend';
import { unregisterCouponlyPushTokenForCurrentUser } from '@/lib/couponlyPush';

type AuthResult = { error?: string; confirmationRequired?: boolean };
type AuthValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  recoveryMode: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string, referralCode?: string) => Promise<AuthResult>;
  sendReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  updateEmail: (email: string) => Promise<AuthResult>;
  refreshSession: () => Promise<AuthResult>;
  refreshStudentAccess: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<AuthResult>;
  clearRecovery: () => void;
};

const noConfig = async (): Promise<AuthResult> => ({ error: 'Authentication is not configured for this build.' });
const AuthContext = createContext<AuthValue>({
  session: null, user: null, loading: true, isGuest: true, recoveryMode: false,
  signIn: noConfig, signUp: noConfig, sendReset: noConfig, updatePassword: noConfig,
  updateEmail: noConfig, refreshSession: noConfig, signOut: async () => {},
  refreshStudentAccess: async () => {}, deleteAccount: noConfig, clearRecovery: () => {},
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

async function accountAccess(uid: string): Promise<'student' | 'admin' | 'incomplete'> {
  const { data, error } = await getSupabase().from('realx_students').select('id').eq('id', uid).maybeSingle();
  if (error) throw error;
  if (data) return 'student';
  const { data: admin, error: roleError } = await getSupabase().rpc('kouponly_is_benefits_admin');
  if (roleError) throw roleError;
  return admin === true ? 'admin' : 'incomplete';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [studentStatus, setStudentStatus] = useState<'none' | 'checking' | 'student' | 'admin' | 'incomplete' | 'error'>('none');
  const [accessOwner,setAccessOwner]=useState<string>();
  const sessionOwner=useRef<string|undefined>(undefined);sessionOwner.current=session?.user.id;
  const accessRequest=useRef(0);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    let authChanged=false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      authChanged=true;
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
        if(!authChanged)setSession(data.session);
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

  const refreshStudentAccess = useCallback(async () => {
    const { data: { user: currentUser }, error: authErrorValue } = await getSupabase().auth.getUser();
    if (authErrorValue) throw authErrorValue;
    const uid = currentUser?.id;
    if (!uid || uid!==sessionOwner.current) return;
    const request=++accessRequest.current;
    setStudentStatus('checking');
    try {
      const status=await accountAccess(uid);
      if(uid===sessionOwner.current&&request===accessRequest.current){setAccessOwner(uid);setStudentStatus(status);}
    } catch (error) {
      if(uid===sessionOwner.current&&request===accessRequest.current)setStudentStatus('error');
      throw error;
    }
  }, []);

  useEffect(() => {
    const request=++accessRequest.current;
    const uid = session?.user.id;
    if (!uid) { setStudentStatus('none'); return; }
    let active = true;
    setStudentStatus('checking');
    void accountAccess(uid)
      .then(status => { if (active&&request===accessRequest.current){setAccessOwner(uid);setStudentStatus(status);} })
      .catch(() => { if (active&&request===accessRequest.current)setStudentStatus('error'); });
    return () => { active = false; };
  }, [session?.user.id]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
      return error ? { error: error.message } : {};
    } catch (error) { return { error: authError(error) }; }
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string, referralCode?: string): Promise<AuthResult> => {
    try {
      const { data, error } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim(), ...(referralCode?.trim() ? { referral_code: referralCode.trim().toUpperCase() } : {}) }, emailRedirectTo: redirectUrl() },
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
    await unregisterCouponlyPushTokenForCurrentUser().catch(() => {});
    try { await getSupabase().auth.signOut({ scope: 'local' }); } catch {}
  }, []);

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    try {
      await deleteAccountCloud();
      await getSupabase().auth.signOut({ scope: 'local' });
      setRecoveryMode(false);
      return {};
    } catch (error) { return { error: authError(error) }; }
  }, []);

  const studentUser = accessOwner===session?.user.id && (studentStatus === 'student' || studentStatus === 'admin') ? session?.user ?? null : null;
  const value = useMemo<AuthValue>(() => ({
    session,
    user: studentUser,
    loading: loading || studentStatus === 'checking',
    isGuest: !studentUser,
    recoveryMode,
    signIn,
    signUp,
    sendReset,
    updatePassword,
    updateEmail,
    refreshSession,
    refreshStudentAccess,
    signOut,
    deleteAccount,
    clearRecovery: () => setRecoveryMode(false),
  }), [session, studentUser, loading, studentStatus, recoveryMode, signIn, signUp, sendReset, updatePassword, updateEmail, refreshSession, refreshStudentAccess, signOut, deleteAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
