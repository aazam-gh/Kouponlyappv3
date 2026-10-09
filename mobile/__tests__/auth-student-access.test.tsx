import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

const mockUser = { id: 'student-session', email: 'student@example.edu', user_metadata: {} };
const mockSession = { user: mockUser, access_token: 'test', refresh_token: 'test', expires_at: 0, token_type: 'bearer' };
const mockMaybeSingle = jest.fn();
const mockAdmin = jest.fn<Promise<{data:boolean;error:null}>, []>(async () => ({data:false,error:null}));
const mockLogout=jest.fn(async()=>({error:null}));
jest.mock('../lib/couponlyPush',()=>({unregisterCouponlyPushTokenForCurrentUser:async()=>{throw Error('offline push registration');}}));
const mockSupabase = {
  rpc: mockAdmin,
  auth: {
    signOut:mockLogout,
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
    getSession: async () => ({ data: { session: mockSession }, error: null }),
    getUser: async () => ({ data: { user: mockUser }, error: null }),
  },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) }),
};

jest.doMock('../lib/supabase', () => ({
  supabase: mockSupabase,
  supabaseConfigured: true,
  getSupabase: () => mockSupabase,
}));

const { AuthProvider, useAuth } = require('../lib/auth') as typeof import('../lib/auth');

function Probe() {
  const { user, loading, refreshStudentAccess, signOut } = useAuth();
  return <>
    <Pressable onPress={()=>void signOut()}><Text>Sign out</Text></Pressable>
    <Text>{loading ? 'checking' : user ? 'student' : 'guest'}</Text>
    <Text>{user?.id ?? 'no-student-id'}</Text>
    {refreshStudentAccess ? <Pressable onPress={() => void refreshStudentAccess()}><Text>Refresh student</Text></Pressable> : null}
  </>;
}

it('keeps authenticated accounts without a student row out of student-only flows until signup completes', async () => {
  mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: { id: mockUser.id }, error: null });
  const view = await render(<AuthProvider><Probe /></AuthProvider>);

  await waitFor(() => expect(view.getByText('guest')).toBeTruthy());
  expect(view.getByText('no-student-id')).toBeTruthy();

  await fireEvent.press(view.getByText('Refresh student'));
  await waitFor(() => expect(view.getByText('student')).toBeTruthy());
  expect(view.getByText(mockUser.id)).toBeTruthy();
});

it('allows the verified existing administrator without creating a student profile', async () => {
  mockMaybeSingle.mockResolvedValue({data:null,error:null}); mockAdmin.mockResolvedValue({data:true,error:null});
  const view=await render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(()=>expect(view.getByText(mockUser.id)).toBeTruthy());
  expect(mockAdmin).toHaveBeenCalledWith('kouponly_is_benefits_admin');
});

it('signs out this device even when push cleanup fails', async () => {
  mockMaybeSingle.mockResolvedValue({data:{id:mockUser.id},error:null});
  const view=await render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(()=>expect(view.getByText(mockUser.id)).toBeTruthy());
  await fireEvent.press(view.getByText('Sign out'));
  await waitFor(()=>expect(mockLogout).toHaveBeenCalledWith({scope:'local'}));
});
