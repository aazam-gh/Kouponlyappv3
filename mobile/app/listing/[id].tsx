import { Redirect, useLocalSearchParams } from 'expo-router';
export default function ListingRoute(){ const {id}=useLocalSearchParams<{id:string}>(); return <Redirect href={{pathname:'/kouponly/vendor/[id]',params:{id:String(id||'')}} as any} />; }
