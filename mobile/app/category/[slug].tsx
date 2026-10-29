import { Redirect, useLocalSearchParams } from 'expo-router';
export default function CategoryRoute(){ const {slug}=useLocalSearchParams<{slug:string}>(); return <Redirect href={{pathname:'/kouponly/category/[id]',params:{id:String(slug||'')}} as any} />; }
