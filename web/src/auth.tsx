import * as React from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

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
  isHoldingAccount: boolean;
  loginWithEmail: (email: string, password: string) => Promise<{admin:boolean;holding:boolean}>;
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
  if (!user) return {admin:false,holding:false};
  const {data,error}=await supabase.from('realx_user_roles').select('role,holding_group_id').eq('user_id',user.id).maybeSingle();
  if (error) throw error;
  return {admin:data?.role==='admin',holding:data?.role==='holding_admin'||Boolean(data?.holding_group_id)};
}
export function AuthContextProvider({children}:{children:React.ReactNode}) {
  const [user,setUser]=React.useState<AdminUser|null>(null);
  const [isInitialLoading,setInitialLoading]=React.useState(true);
  const [isAdmin,setAdmin]=React.useState(false);
  const [isHoldingAccount,setHolding]=React.useState(false);
  React.useEffect(()=>{
    let active=true;
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      const next=asAdminUser(session?.user||null);
      setUser(next);
      if(!next){setAdmin(false);setHolding(false);setInitialLoading(false);return;}
      queueMicrotask(()=>{void loadRole(session!.user).then(role=>{
        if(active){setAdmin(role.admin);setHolding(role.holding);setInitialLoading(false);}
      }).catch(()=>{if(active){setAdmin(false);setHolding(false);setInitialLoading(false);}});});
    });
    return ()=>{active=false;subscription.unsubscribe();};
  },[]);
  const logout=React.useCallback(async()=>{
    const {error}=await supabase.auth.signOut();if(error)throw error;
    setUser(null);setAdmin(false);setHolding(false);setInitialLoading(false);
  },[]);
  const loginWithEmail=React.useCallback(async(email:string,password:string)=>{
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error)throw error;
    const role=await loadRole(data.user);
    setUser(asAdminUser(data.user));setAdmin(role.admin);setHolding(role.holding);setInitialLoading(false);
    return role;
  },[]);
  const value=React.useMemo(()=>({isAuthenticated:Boolean(user),isInitialLoading,isAdmin,isHoldingAccount,user,loginWithEmail,logout}),[user,isInitialLoading,isAdmin,isHoldingAccount,loginWithEmail,logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context=React.useContext(AuthContext);
  if(!context)throw new Error('useAuth must be used within an AuthContextProvider');
  return context;
}
