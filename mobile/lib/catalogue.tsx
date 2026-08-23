import React,{createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {applyCataloguePatch,campaigns,categories,deals,directoryItems,heroSlides,rewards,type Campaign,type Category,type Deal,type DirectoryItem,type HeroSlide,type Reward} from '@/lib/data';

type CatalogueStatus='bundled'|'loading'|'cloud'|'offline';
type Value={status:CatalogueStatus;revision:number;refresh:()=>Promise<void>};
const Context=createContext<Value>({status:'bundled',revision:0,refresh:async()=>{}});
const merge=<T extends {id?:string|number}>(base:T[],incoming:T[])=>{const byId=new Map(base.map(item=>[String(item.id),item]));return incoming.map(item=>({...byId.get(String(item.id)),...item} as T)).concat(base.filter(item=>!incoming.some(next=>String(next.id)===String(item.id))));};
const rows=<T,>(value:{id:string;payload:unknown}[]|null)=>((value??[]).map(row=>typeof row.payload==='object'&&row.payload?{...(row.payload as Record<string,unknown>),id:(row.payload as Record<string,unknown>).id??row.id}:row.payload).filter(Boolean) as T[]);

export function CatalogueProvider({children}:{children:React.ReactNode}){
  const [status,setStatus]=useState<CatalogueStatus>('bundled');const [revision,setRevision]=useState(0);
  const refresh=useCallback(async()=>{setStatus('bundled');setRevision(value=>value+1);},[]);
  useEffect(()=>{void refresh();},[refresh]);
  const value=useMemo(()=>({status,revision,refresh}),[status,revision,refresh]);return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useCatalogue=()=>useContext(Context);
