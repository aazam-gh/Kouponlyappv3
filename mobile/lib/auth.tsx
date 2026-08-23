import React,{createContext,useCallback,useContext,useMemo,useState} from 'react';

export type User = {id:string;email?:string;user_metadata:Record<string,unknown>};
export type Session = {user:User};

type AuthResult={error?:string;confirmationRequired?:boolean};
type AuthValue={session:Session|null;user:User|null;loading:boolean;isGuest:boolean;recoveryMode:boolean;signIn:(email:string,password:string)=>Promise<AuthResult>;signUp:(name:string,email:string,password:string)=>Promise<AuthResult>;sendReset:(email:string)=>Promise<AuthResult>;updatePassword:(password:string)=>Promise<AuthResult>;updateEmail:(email:string)=>Promise<AuthResult>;refreshSession:()=>Promise<AuthResult>;signOut:()=>Promise<void>;deleteAccount:()=>Promise<AuthResult>;clearRecovery:()=>void};
const unavailable=async():Promise<AuthResult>=>({error:'Authentication is unavailable.'});
const AuthContext=createContext<AuthValue>({session:null,user:null,loading:false,isGuest:true,recoveryMode:false,signIn:unavailable,signUp:unavailable,sendReset:unavailable,updatePassword:unavailable,updateEmail:unavailable,refreshSession:unavailable,signOut:async()=>{},deleteAccount:unavailable,clearRecovery:()=>{}});

export function AuthProvider({children}:{children:React.ReactNode}){
  const [recoveryMode,setRecoveryMode]=useState(false);
  const signOut=useCallback(async()=>setRecoveryMode(false),[]);
  const value=useMemo<AuthValue>(()=>({session:null,user:null,loading:false,isGuest:true,recoveryMode,signIn:unavailable,signUp:unavailable,sendReset:unavailable,updatePassword:unavailable,updateEmail:unavailable,refreshSession:unavailable,signOut,deleteAccount:unavailable,clearRecovery:()=>setRecoveryMode(false)}),[recoveryMode,signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
