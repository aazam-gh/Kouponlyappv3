import { supabase } from '@/lib/supabase';
export function httpsCallable<I=any,O=any>(_functions: unknown,name: string) {
  return async (data: I): Promise<{data:O}> => {
    const {data:result,error}=await supabase.functions.invoke('kouponly-admin-action',{body:{action:name,data}});
    if(error){
      let message=error.message||'The admin action failed.';
      try{const details=await (error as any).context?.json?.();if(details?.error)message=details.error;}catch{}
      throw new Error(message);
    }
    return {data:result as O};
  };
}
