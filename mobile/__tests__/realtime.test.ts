const mockChannel={on:jest.fn().mockReturnThis(),subscribe:jest.fn()};const mockRemove=jest.fn();
jest.mock('../lib/supabase',()=>({supabaseConfigured:true,getSupabase:()=>({channel:()=>mockChannel,removeChannel:mockRemove})}));
import {subscribeToCatalogue} from '../lib/backend';
import {queryClient,TRANSIENT_QUERY_GC_TIME_MS} from '../utils/queryClient';
it('subscribes to published catalogue tables and removes the channel on cleanup',()=>{
 const subscription=subscribeToCatalogue(()=>{});const tables=mockChannel.on.mock.calls.map(call=>call[1].table);
 expect(tables).toContain('couponly_vendors');expect(tables).toContain('couponly_cms_documents');expect(tables.every(table=>table.startsWith('couponly_'))).toBe(true);
 subscription.unsubscribe();expect(mockRemove).toHaveBeenCalledWith(mockChannel);
});
it('does not leave cache expiry timers running in the test environment',()=>{
 expect(queryClient.getDefaultOptions().queries?.gcTime).toBe(Infinity);expect(TRANSIENT_QUERY_GC_TIME_MS).toBe(Infinity);
});
