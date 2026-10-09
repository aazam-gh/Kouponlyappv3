import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { BenefitsProvider, benefitsError, benefitsRpc, useBenefits } from '../lib/benefits';
let mockUser: {id: string} | null = {id:'alice'};
const mockRpc = jest.fn();
jest.mock('../lib/auth', () => ({useAuth: () => ({user: mockUser})}));
jest.mock('../lib/supabase', () => ({getSupabase: () => ({rpc: mockRpc})}));
jest.mock('../lib/backend', () => ({makeMutationId: () => 'test-operation'}));
let reader: ReturnType<typeof useBenefits>;
function Reader() { reader = useBenefits(); const {benefits, error} = reader; return <><Text>{benefits?.inviteCode ?? 'none'}</Text><Text>{error}</Text><Text>{`used:${benefits?.usedVendorIds?.join(',') ?? ''}`}</Text></>; }
afterEach(() => {cleanup(); jest.clearAllMocks(); mockUser={id:'alice'};});
it('renders assigned server state and clears it immediately on account switch', async () => {
  mockRpc.mockImplementation((name: string) => Promise.resolve({data: name==='kouponly_account_benefits' ? {inviteCode:'AB234'} : false,error:null}));
  const view = await render(<BenefitsProvider><Reader /></BenefitsProvider>);
  await waitFor(() => expect(view.getByText('AB234')).toBeTruthy());
  mockUser=null; await view.rerender(<BenefitsProvider><Reader /></BenefitsProvider>);
  expect(view.getByText('none')).toBeTruthy(); expect(view.queryByText('AB234')).toBeNull();
});
it('does not apply a previous account response after switching accounts', async () => {
  let resolveAlice: (value: unknown) => void = () => {};
  mockRpc.mockImplementation((name: string) => name==='kouponly_account_benefits' ? mockUser?.id==='alice' ? new Promise(resolve => {resolveAlice=resolve;}) : Promise.resolve({data:{inviteCode:'CD567'},error:null}) : Promise.resolve({data:false,error:null}));
  const view = await render(<BenefitsProvider><Reader /></BenefitsProvider>);
  mockUser={id:'bob'}; await view.rerender(<BenefitsProvider><Reader /></BenefitsProvider>);
  await waitFor(() => expect(view.getByText('CD567')).toBeTruthy());
  await act(async () => resolveAlice({data:{inviteCode:'AB234'},error:null}));
  expect(view.queryByText('AB234')).toBeNull(); expect(view.getByText('CD567')).toBeTruthy();
});
it('converts backend validation errors into actionable messages', async () => {
  mockRpc.mockResolvedValue({data:{error:'SELF_REFERRAL'},error:null});
  await expect(benefitsRpc('kouponly_claim_code')).rejects.toThrow('You cannot use your own invite code.');
  expect(benefitsError('ROUND_CHANGED')).toContain('confirm again');
});
it('shows a backend load failure without inventing an invite code', async () => {
  mockRpc.mockResolvedValue({data:null,error:{message:'Connection unavailable'}});
  const view = await render(<BenefitsProvider><Reader /></BenefitsProvider>);
  await waitFor(() => expect(view.getByText('Connection unavailable')).toBeTruthy()); expect(view.getByText('none')).toBeTruthy();
});

it('does not replace newer coupon state with an old successful claim receipt', async () => {
  let claimed=false; const latest={inviteCode:'AB234',serverTime:'2026-10-08T12:00:00Z',usedVendorIds:['vendor-one']};
  mockRpc.mockImplementation((name:string)=> name==='kouponly_claim_code' ? Promise.resolve({data:{kind:'voucher',status:'rewarded',benefits:{...latest,serverTime:'2026-10-08T11:00:00Z',usedVendorIds:[]}},error:null}) : name==='kouponly_account_benefits' ? claimed ? new Promise(()=>{}) : Promise.resolve({data:latest,error:null}) : Promise.resolve({data:false,error:null}));
  const view=await render(<BenefitsProvider><Reader /></BenefitsProvider>);await waitFor(()=>expect(view.getByText('used:vendor-one')).toBeTruthy());
  claimed=true;await act(async()=>{await reader.claim('KPN-TEST','operation-one');});
  expect(view.getByText('used:vendor-one')).toBeTruthy();
});

it('clears stale benefits when the server withdraws account eligibility',async()=>{
 mockRpc.mockImplementation((name:string)=>Promise.resolve({data:name==='kouponly_account_benefits'?{inviteCode:'AB234'}:false,error:null}));
 const view=await render(<BenefitsProvider><Reader/></BenefitsProvider>);await waitFor(()=>expect(view.getByText('AB234')).toBeTruthy());
 mockRpc.mockResolvedValue({data:null,error:{message:'Verified @rajagiri.edu.in email required'}});
 await act(async()=>{await reader.refresh().catch(()=>{});});expect(view.queryByText('AB234')).toBeNull();expect(view.getByText('none')).toBeTruthy();
});
