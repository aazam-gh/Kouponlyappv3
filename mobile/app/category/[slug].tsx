import { Redirect, useLocalSearchParams } from 'expo-router';
export default function CategoryRoute(){ const {slug}=useLocalSearchParams<{slug:string}>(); return <Redirect href={{pathname:'/realx/category/[id]',params:{id:String(slug||'')}} as any} />; }
