import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { applyMutation, completeRedemptionCloud, fetchCloudState, makeMutationId, redeemRewardCloud, subscribeToUser, validateRedemption } from "@/lib/backend";
import type { PendingMutation, SyncStatus } from "@/lib/cloud.types";

export type RedemptionMode = "online" | "inStore";
export type RedemptionStatus = "warning" | "code" | "success" | "expired";
export type RedemptionSession = { id: string; mode: RedemptionMode; status: RedemptionStatus; code?: string; expiresAt?: number; completedAt?: number; consumedAt?:number };
export type KouponlyState = {
  version: 3; saved: number[]; savedOffers:string[]; used: number[]; offerUsage:Record<string,number>;
  interests: string[]; redemptions: Record<string, RedemptionSession>;
  redeemedRewards: string[]; points: number;
};

const KEY = "kouponly.guest.state.v3";
const OLD_CURRENT_KEY = "kouponly.prototype.state.v3";
const PREVIOUS_KEY = "kouponly.prototype.state.v2";
const LEGACY_KEY = "kouponly.prototype.state.v1";
export const initialState: KouponlyState = { version:3, saved:[], savedOffers:[], used:[], offerUsage:{}, interests:[], redemptions:{}, redeemedRewards:[], points:0 };

export function replaceWithCloudState(cloud:Partial<KouponlyState>):KouponlyState{return {...initialState,...cloud,version:3,saved:cloud.saved??[],savedOffers:cloud.savedOffers??[],used:cloud.used??[],offerUsage:cloud.offerUsage??{},interests:cloud.interests??[],redemptions:cloud.redemptions??{},redeemedRewards:cloud.redeemedRewards??[],points:cloud.points??0};}

export function migrateState(value: unknown): KouponlyState {
  if (!value || typeof value !== "object") return initialState;
  const v = value as Partial<KouponlyState>;
  const list = (candidate: unknown) => Array.isArray(candidate) ? candidate : [];
  return {
    ...initialState,
    version:3,
    saved: list(v.saved).filter(Number.isFinite) as number[], savedOffers:list((v as any).savedOffers).filter(x=>typeof x==="string") as string[],
    used: list(v.used).filter(Number.isFinite) as number[],
    offerUsage:(v as any).offerUsage&&typeof (v as any).offerUsage==="object"?(v as any).offerUsage:{},
    interests: list(v.interests).filter(x => typeof x === "string") as string[],
    redemptions: v.redemptions && typeof v.redemptions === "object" ? v.redemptions : {},
    redeemedRewards: list(v.redeemedRewards).filter(x => typeof x === "string") as string[],
    points: typeof v.points === "number" ? v.points : 0,
  };
}

type Action =
  | { type:"hydrate"; state:KouponlyState }
  | { type:"toggleSaved"; id:number }
  | { type:"toggleSavedOffer"; id:string }
  | { type:"toggleInterest"; id:string }
  | { type:"startRedemption"; session:RedemptionSession }
  | { type:"updateRedemption"; id:string; patch:Partial<RedemptionSession> }
  | { type:"redeemReward"; id:string; points:number }
  | { type:"syncReward"; id:string; points:number };

export function reducer(state: KouponlyState, action: Action): KouponlyState {
  if (action.type === "hydrate") return action.state;
  if (action.type === "toggleSaved") return { ...state, saved: state.saved.includes(action.id) ? state.saved.filter(id=>id!==action.id) : [...state.saved, action.id] };
  if (action.type === "toggleSavedOffer") return { ...state, savedOffers:state.savedOffers.includes(action.id)?state.savedOffers.filter(id=>id!==action.id):[...state.savedOffers,action.id] };
  if (action.type === "toggleInterest") return { ...state, interests: state.interests.includes(action.id) ? state.interests.filter(id=>id!==action.id) : [...state.interests, action.id] };
  if (action.type === "startRedemption") return { ...state, redemptions:{...state.redemptions,[action.session.id]:action.session} };
  if (action.type === "updateRedemption") {
    const current = state.redemptions[action.id];
    if (!current) return state;
    const consuming=!current.consumedAt&&Boolean(action.patch.consumedAt);
    const next = { ...current, ...action.patch };
    const dealMatch=action.id.match(/^deal-(\d+)(?:-(\d+))?/);const dealId=dealMatch?Number(dealMatch[1]):null;const offerKey=dealMatch?`${dealMatch[1]}-${dealMatch[2]??0}`:null;
    const used = consuming&&dealId ? [...new Set([...state.used,dealId])] : state.used;
    const offerUsage=consuming&&offerKey?{...state.offerUsage,[offerKey]:Math.min(1,(state.offerUsage[offerKey]??0)+1)}:state.offerUsage;
    return { ...state, used,offerUsage, redemptions:{...state.redemptions,[action.id]:next} };
  }
  if (action.type === "redeemReward" && state.points >= action.points && !state.redeemedRewards.includes(action.id)) return { ...state, points:state.points-action.points, redeemedRewards:[...state.redeemedRewards,action.id] };
  if (action.type === "syncReward") return { ...state, points: action.points, redeemedRewards: [...new Set([...state.redeemedRewards, action.id])] };
  return state;
}

type StoreValue = {
  state:KouponlyState; hydrated:boolean; toast:string; cloudStatus:SyncStatus;
  toggleSaved:(id:number)=>void; toggleSavedOffer:(id:string)=>void; toggleInterest:(id:string)=>void;
  startRedemption:(id:string,mode:RedemptionMode)=>void; updateRedemption:(id:string,patch:Partial<RedemptionSession>)=>void;
  confirmRedemption:(id:string)=>Promise<boolean>;
  completeRedemption:(id:string)=>Promise<boolean>;
  redeemReward:(id:string,points:number)=>Promise<boolean>; notify:(message:string)=>void; retrySync:()=>Promise<void>;
};
const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({children}:{children:React.ReactNode}) {
  const {user}=useAuth();
  const [state,dispatch] = useReducer(reducer,initialState);
  const [hydratedAccount,setHydratedAccount] = useState<string>();
  const hydrated=hydratedAccount===(user?.id??"guest");
  const [toast,setToast] = useState("");
  const [cloudStatus,setCloudStatus]=useState<SyncStatus>("guest");const activeUser=useRef<string|null>(null);const queueRef=useRef<PendingMutation[]>([]);
  const userKey=(id:string)=>`kouponly.user.${id}.state.v3`;const queueKey=(id:string)=>`kouponly.user.${id}.pending.v1`;
  const persistQueue=useCallback(async(id:string)=>AsyncStorage.setItem(queueKey(id),JSON.stringify(queueRef.current)),[]);
  const flushing=useRef<{id:string;promise:Promise<void>}|null>(null);
  const flushQueue=useCallback(async()=>{
    const id=activeUser.current;if(!id||!queueRef.current.length)return;
    if(flushing.current?.id===id)return flushing.current.promise;
    const run=async()=>{
      setCloudStatus("syncing");
      const attempted=new Set<string>();
      let item:PendingMutation|undefined;
      while((item=queueRef.current.find(entry=>!attempted.has(entry.id)))){
        attempted.add(item.id);
        if(activeUser.current!==id)return;
        try{await applyMutation(item);if(activeUser.current!==id)return;queueRef.current=queueRef.current.filter(entry=>entry.id!==item!.id);}
        catch{if(activeUser.current!==id)return;item.attempts++;await persistQueue(id);break;}
        await persistQueue(id);
      }
      if(activeUser.current===id)setCloudStatus(queueRef.current.length?"offline":"synced");
    };
    const promise=run();flushing.current={id,promise};
    try{await promise;}finally{if(flushing.current?.promise===promise)flushing.current=null;}
  },[persistQueue]);
  const enqueue=useCallback((kind:PendingMutation['kind'],entityId:string,operation:PendingMutation['operation'],payload:Record<string,unknown>={})=>{const id=activeUser.current;if(!id)return;queueRef.current.push({id:makeMutationId(),userId:id,kind,entityId,operation,payload,createdAt:Date.now(),attempts:0});void persistQueue(id).then(flushQueue).catch(()=>{if(activeUser.current===id)setCloudStatus("offline")})},[persistQueue,flushQueue]);
  const refreshCloud=useCallback(async()=>{const id=activeUser.current;if(!id)return;try{await flushQueue();if(id!==activeUser.current||queueRef.current.length)return;const cloud=await fetchCloudState();if(id!==activeUser.current||queueRef.current.length)return;if(cloud){const next=replaceWithCloudState(cloud);dispatch({type:"hydrate",state:next});await AsyncStorage.setItem(userKey(id),JSON.stringify(next));}setCloudStatus("synced");await flushQueue();}catch{if(id===activeUser.current)setCloudStatus("offline")}},[flushQueue]);
  useEffect(()=>{let active=true;(async()=>{setHydratedAccount(undefined);const id=user?.id??null;activeUser.current=id;queueRef.current=[];dispatch({type:"hydrate",state:initialState});try{if(!id){const current=await AsyncStorage.getItem(KEY);const old=current?null:await AsyncStorage.getItem(OLD_CURRENT_KEY);const previous=current||old?null:await AsyncStorage.getItem(PREVIOUS_KEY);const legacy=current||old||previous?null:await AsyncStorage.getItem(LEGACY_KEY);if(!active)return;dispatch({type:"hydrate",state:(current||old||previous||legacy)?migrateState(JSON.parse((current??old??previous??legacy)!)):initialState});queueRef.current=[];setCloudStatus("guest");}
    else{setCloudStatus("loading-cloud");const [cached,pending]=await Promise.all([AsyncStorage.getItem(userKey(id)),AsyncStorage.getItem(queueKey(id))]);if(!active)return;if(cached)dispatch({type:"hydrate",state:migrateState(JSON.parse(cached))});queueRef.current=pending?JSON.parse(pending):[];await refreshCloud();}}
    catch{if(active&&id)setCloudStatus("offline");}finally{if(active)setHydratedAccount(id??"guest")}})();return()=>{active=false}},[user?.id,refreshCloud]);
  useEffect(()=>{if(!hydrated||activeUser.current!==(user?.id??null))return;const key=user?.id?userKey(user.id):KEY;AsyncStorage.setItem(key,JSON.stringify(state)).catch(()=>{})},[state,hydrated,user?.id]);
  useEffect(()=>{
    if(!user)return;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const subscription=subscribeToUser(user.id,()=>{
      if(timer)clearTimeout(timer);
      timer=setTimeout(()=>{void refreshCloud()},180);
    });
    const appState=AppState.addEventListener("change",next=>{if(next==="active")void refreshCloud()});
    return()=>{if(timer)clearTimeout(timer);subscription.unsubscribe();appState.remove()};
  },[user?.id,refreshCloud,flushQueue]);
  const toastTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>()=>{if(toastTimer.current)clearTimeout(toastTimer.current);activeUser.current=null;},[]);
  const notify = useCallback((message:string)=>{if(toastTimer.current)clearTimeout(toastTimer.current);setToast(message);toastTimer.current=setTimeout(()=>setToast(""),2200);},[]);
  const value = useMemo<StoreValue>(()=>({
    state,hydrated,toast,notify,cloudStatus,
    toggleSaved:id=>{const removing=state.saved.includes(id);dispatch({type:"toggleSaved",id});if(user)enqueue('save-deal',String(id),removing?'delete':'upsert')},
    toggleSavedOffer:id=>{const removing=state.savedOffers.includes(id);dispatch({type:"toggleSavedOffer",id});if(user)enqueue('save-offer',id,removing?'delete':'upsert')},
    toggleInterest:id=>{const removing=state.interests.includes(id);dispatch({type:"toggleInterest",id});if(user)enqueue('interest',id,removing?'delete':'upsert')},
    startRedemption:(id,mode)=>dispatch({type:"startRedemption",session:{id,mode,status:"warning"}}),
    updateRedemption:(id,patch)=>dispatch({type:"updateRedemption",id,patch}),
    confirmRedemption:async id=>{const session=state.redemptions[id];if(!user||!session||session.status!=="warning")return false;try{const result=await validateRedemption(id,session.mode);if(activeUser.current!==user.id)return false;dispatch({type:"updateRedemption",id,patch:{status:result.status,code:result.code??undefined,expiresAt:result.expiresAt??undefined,completedAt:session.mode==="inStore"?result.consumedAt:undefined,consumedAt:result.consumedAt}});return true}catch(error){if(activeUser.current!==user?.id)return false;setCloudStatus("error");notify(error instanceof Error?error.message:"Redemption could not be confirmed");return false}},
    completeRedemption:async id=>{const session=state.redemptions[id];if(!user||!session||session.status!=="code")return false;try{const result=await completeRedemptionCloud(id);if(activeUser.current!==user.id)return false;dispatch({type:"updateRedemption",id,patch:{status:result.status,completedAt:result.completedAt}});return true}catch(error){if(activeUser.current!==user?.id)return false;setCloudStatus("error");notify(error instanceof Error?error.message:"Redemption could not be completed");return false}},
    redeemReward:async(id,points)=>{if(state.points<points||state.redeemedRewards.includes(id))return false;if(!user){dispatch({type:"redeemReward",id,points});return true}try{const result=await redeemRewardCloud(id);if(activeUser.current!==user.id)return false;dispatch({type:"syncReward",id,points:result.points});return true}catch(error){if(activeUser.current!==user?.id)return false;setCloudStatus("error");notify(error instanceof Error?error.message:"Reward could not be redeemed");return false}},
    retrySync:refreshCloud,
  }),[state,hydrated,toast,notify,cloudStatus,user,enqueue,flushQueue,refreshCloud]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
export const useStore = () => { const value=useContext(StoreContext); if(!value) throw new Error("useStore must be inside StoreProvider"); return value; };

export const remainingSeconds = (expiresAt:number|undefined, now=Date.now()) => expiresAt ? Math.max(0,Math.ceil((expiresAt-now)/1000)) : 0;
