import { submitStudentRequest } from '../lib/student-community';
import { getSupabase } from '../lib/supabase';
jest.mock('../lib/supabase', () => ({ supabaseConfigured: true, getSupabase: jest.fn() }));
const invoke = jest.fn();
const request = { kind: 'school' as const, name: ' Marina University ', domain: ' MARINA.EDU ', email: ' Applicant@Marina.edu ', contact: 'Student Name', phone: '+919876543210' };
beforeEach(() => { jest.clearAllMocks(); (getSupabase as jest.Mock).mockReturnValue({ functions: { invoke } }); });
test('submissions use the protected endpoint and preserve the retry id', async () => {
  invoke.mockResolvedValue({ data: { requestId: 'retry-id' }, error: null });
  await submitStudentRequest(request, 'retry-id');
  expect(invoke).toHaveBeenCalledWith('kouponly-mobile-action', { body: { action: 'submitStudentRequest', data: { ...request, name: 'Marina University', domain: 'marina.edu', email: 'applicant@marina.edu', id: 'retry-id' } } });
});
test('server quota errors reach the form', async () => {
  invoke.mockResolvedValue({ error: { message: 'Non-2xx response', context: { json: async () => ({ error: 'Daily limit reached' }) } } });
  await expect(submitStudentRequest(request, 'retry-id')).rejects.toThrow('Daily limit reached');
});
test('invalid requests do not call the server', async () => {
  await expect(submitStudentRequest({ ...request, domain: 'invalid domain' }, 'retry-id')).rejects.toThrow('school email domain');
  expect(invoke).not.toHaveBeenCalled();
});
