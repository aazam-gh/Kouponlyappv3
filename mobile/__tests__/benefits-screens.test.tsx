import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import EnterCodeScreen from '../app/enter-code';
import InviteCodeCard from '../components/InviteCodeCard';
import { AppThemeProvider } from '../context/AppThemeContext';
import { LocaleProvider } from '../context/LocaleContext';
import * as Clipboard from 'expo-clipboard';

const mockRefresh = jest.fn(async () => {}); const mockClaim = jest.fn();
const mockRetry = jest.fn(async () => {});
const mockBenefits = { usedVendorIds: [], inviteCode: 'AB234', referralLimit: 3, rewardedReferrals: 1, subscription: { planName: 'Free Kouponly membership', endsAt: '2026-11-08T10:00:00Z', roundNumber: 1, cancelAtPeriodEnd: false } };
let mockError = ''; let mockUser: { id: string } | null = { id: 'alice' };
jest.mock('../lib/benefits', () => ({useBenefits: () => ({benefits: mockBenefits, loading: false, error: mockError, refresh: mockRefresh, claim: mockClaim}), makeMutationId: () => '11111111-1111-4111-8111-111111111111'}));
jest.mock('../lib/auth', () => ({useAuth: () => ({user: mockUser})}));
jest.mock('../lib/store', () => ({useStore: () => ({retrySync: mockRetry})}));
jest.mock('../lib/profile', () => ({useProfile: () => ({profile: {mobile: ''}})}));
jest.mock('expo-clipboard', () => ({setStringAsync: jest.fn(async () => {})}));
const wrap = (node: React.ReactNode) => render(<SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:393,height:852},insets:{top:59,bottom:34,left:0,right:0}}}><AppThemeProvider><LocaleProvider>{node}</LocaleProvider></AppThemeProvider></SafeAreaProvider>);
afterEach(() => {cleanup(); jest.clearAllMocks(); mockError=''; mockUser={id:'alice'};});
it('displays the assigned code, copies it, and opens code entry', async () => {
  const view = await wrap(<InviteCodeCard />);
  expect(view.getByText('AB234')).toBeTruthy();
  await fireEvent.press(view.getByText('Copy code')); expect(Clipboard.setStringAsync).toHaveBeenCalledWith('AB234');
  expect(view.getByText('Invite code copied')).toBeTruthy();
  await fireEvent.press(view.getByText('Enter a code')); expect(router.push).toHaveBeenCalledWith('/enter-code');
});
it('keeps the draft after failure and uses the same operation ID on retry', async () => {
  mockClaim.mockRejectedValueOnce(new Error('Check your connection.')).mockResolvedValueOnce({kind:'invite',rewardRecipient:'inviter',status:'rewarded'});
  const view = await wrap(<EnterCodeScreen />);
  await fireEvent.changeText(view.getByLabelText('Friend’s invite code'), 'ab234');
  await fireEvent.press(view.getByText('Apply code'));
  await waitFor(() => expect(view.getByText('Check your connection.')).toBeTruthy());
  expect(view.getByLabelText('Friend’s invite code').props.value).toBe('AB234');
  await fireEvent.press(view.getByText('Apply code'));
  await waitFor(() => expect(view.getByText('Invite applied. Your friend’s coupons have refreshed.')).toBeTruthy());
  expect(mockClaim.mock.calls[0]).toEqual(mockClaim.mock.calls[1]); expect(mockRetry).toHaveBeenCalledTimes(1);
});
it('attributes invite success to the owner rather than the entrant', async () => {
  mockClaim.mockResolvedValueOnce({kind:'invite',status:'rewarded'});
  const view = await wrap(<EnterCodeScreen />);
  await fireEvent.changeText(view.getByLabelText('Friend’s invite code'), 'AB234'); await fireEvent.press(view.getByText('Apply code'));
  await waitFor(() => expect(view.getByText('Invite applied. Your friend’s coupons have refreshed.')).toBeTruthy());
});
it('routes guests to authentication instead of claiming', async () => {
  mockUser=null; const view = await wrap(<EnterCodeScreen />);
  await fireEvent.changeText(view.getByLabelText('Friend’s invite code'), 'AB234'); await fireEvent.press(view.getByText('Sign in to apply code'));
  expect(mockClaim).not.toHaveBeenCalled(); expect(router.push).toHaveBeenCalledWith({pathname:'/kouponly/onboarding',params:{flow:'login'}});
});

it('shares an invite that welcomes every verified email domain', async () => {
  const share=jest.spyOn(Share,'share').mockResolvedValue({action:Share.sharedAction});
  const view=await wrap(<InviteCodeCard />);
  expect(view.getByText(/friends using any email address/)).toBeTruthy();
  await fireEvent.press(view.getByText('Share code'));
  expect(share).toHaveBeenCalledWith({message:'Join me on Kouponly! Enter my invite code AB234. Free coupons with any verified email address.'});
  share.mockRestore();
});
