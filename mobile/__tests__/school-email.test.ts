import { assertAllowedStudentEmail, SCHOOL_EMAIL_MESSAGE } from '../lib/school-email';
const mockRpc=jest.fn();
jest.mock('../lib/supabase',()=>({getSupabase:()=>({rpc:mockRpc})}));
it('uses the server policy for added domains instead of a fixed Rajagiri regex',async()=>{
 mockRpc.mockResolvedValue({data:true,error:null});
 await assertAllowedStudentEmail(' Student@NewCollege.edu ');
 expect(mockRpc).toHaveBeenCalledWith('kouponly_school_email',{p_email:'student@newcollege.edu'});
});
it('rejects inactive domains and fails closed if policy lookup fails',async()=>{
 mockRpc.mockResolvedValue({data:false,error:null});
 await expect(assertAllowedStudentEmail('student@gmail.com')).rejects.toThrow(SCHOOL_EMAIL_MESSAGE);
 mockRpc.mockResolvedValue({data:null,error:new Error('offline')});
 await expect(assertAllowedStudentEmail('student@rajagiri.edu.in')).rejects.toThrow('offline');
});
