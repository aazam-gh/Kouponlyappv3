import * as React from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { identifyAnalyticsUser, resetAnalyticsUser } from './analytics';
import { useQueryClient } from '@tanstack/react-query';

export type AdminUser = SupabaseUser & {
  uid: string;
  name?: string;
  avatar?: string;
  displayName: string;
  photoURL: string | null;
};
export type AuthContextType = {
  isAuthenticated: boolean;
  isInitialLoading: boolean;
  isAdmin: boolean;
  loginWithIdentifier: (identifier: string, password: string) => Promise<{admin:boolean}>;
  logout: () => Promise<void>;
  user: AdminUser | null;
};
const AuthContext = React.createContext<AuthContextType | null>(null);
const asAdminUser = (user: SupabaseUser | null): AdminUser | null => user ? {
  ...user, uid: user.id, name: String(user.user_metadata?.full_name || user.email || 'Admin'),
  avatar: String(user.user_metadata?.avatar_url || ''),
  displayName: String(user.user_metadata?.full_name || user.email || 'Admin'),
  photoURL: typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null,
} : null;
async function loadRole(user: SupabaseUser | null) {
  if (!user) return {admin:false};
  let {data,error}=await supabase.from('couponly_user_roles').select('role').eq('user_id',user.id).maybeSingle();
  if(error && ['42P01','PGRST205'].includes(error.code)) {
    ({data,error}=await supabase.from('realx_user_roles').select('role').eq('user_id',user.id).maybeSingle());
  }
  if (error) throw error;
  return {admin:data?.role==='admin'};
}
async function vendorUsernameAuthEmail(username: string) {
  const bytes = new TextEncoder().encode(username);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const localPart = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return `${localPart}@vendor.kouponly.invalid`;
}
export function AuthContextProvider({children}:{children:React.ReactNode}) {
  const queryClient=useQueryClient();
  const roleRequest=React.useRef(0);
  const owner=React.useRef<string|null>(null);
  const [user,setUser]=React.useState<AdminUser|null>(null);
  const [isInitialLoading,setInitialLoading]=React.useState(true);
  const [isAdmin,setAdmin]=React.useState(false);
  React.useEffect(()=>{if(user)identifyAnalyticsUser(user.id);},[user?.id]);
  React.useEffect(()=>{
    let active=true;
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      const next=asAdminUser(session?.user||null);
      const request=++roleRequest.current;
      if(owner.current!==next?.id){queryClient.clear();setAdmin(false);}
      owner.current=next?.id??null;
      setUser(next);
      if(!next){setAdmin(false);setInitialLoading(false);return;}
      queueMicrotask(()=>{void loadRole(session!.user).then(role=>{
        if(active && request===roleRequest.current){setAdmin(role.admin);setInitialLoading(false);}
      }).catch(()=>{if(active && request===roleRequest.current){setAdmin(false);setInitialLoading(false);}});});
    });
    return ()=>{active=false;++roleRequest.current;subscription.unsubscribe();};
  },[queryClient]);
  const logout=React.useCallback(async()=>{
    const {error}=await supabase.auth.signOut();if(error)throw error;
    ++roleRequest.current;owner.current=null;queryClient.clear();
    resetAnalyticsUser();
    setUser(null);setAdmin(false);setInitialLoading(false);
  },[queryClient]);
  const loginWithIdentifier=React.useCallback(async(identifier:string,password:string)=>{
    let {data,error}=await supabase.auth.signInWithPassword({email:identifier,password});
    if(error){
      const usernameEmail=await vendorUsernameAuthEmail(identifier);
      const usernameLogin=await supabase.auth.signInWithPassword({email:usernameEmail,password});
      data=usernameLogin.data;
      error=usernameLogin.error;
    }
    if(error)throw error;
    const request=++roleRequest.current;
    const role=await loadRole(data.user);
    if(request!==roleRequest.current || owner.current!==data.user?.id)throw new Error('The sign-in session changed. Please sign in again.');
    setUser(asAdminUser(data.user));setAdmin(role.admin);setInitialLoading(false);
    return role;
  },[]);
  const value=React.useMemo(()=>({isAuthenticated:Boolean(user),isInitialLoading,isAdmin,user,loginWithIdentifier,logout}),[user,isInitialLoading,isAdmin,loginWithIdentifier,logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context=React.useContext(AuthContext);
  if(!context)throw new Error('useAuth must be used within an AuthContextProvider');
  return context;
}
