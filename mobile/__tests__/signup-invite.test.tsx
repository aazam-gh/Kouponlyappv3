import React from 'react';
import { Alert, Linking } from 'react-native';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import Signup from '../app/realx/onboarding';
const mockSend=jest.fn(async(...args:any[])=>{void args;});
const mockComplete=jest.fn(async(...args:unknown[])=>{void args;return {success:true};}); const mockClaim=jest.fn(); const mockRefresh=jest.fn(async()=>{});
jest.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key})}));
jest.mock('../lib/auth',()=>({useAuth:()=>({user:null,refreshStudentAccess:mockRefresh})}));
jest.mock('../lib/benefits',()=>({benefitsRpc:(...args:any[])=>mockClaim(...args),makeMutationId:()=> 'signup-operation'}));
jest.mock('../lib/supabase',()=>({getSupabase:()=>({auth:{getUser:async()=>({data:{user:{id:'qa-user'}}})}})}));
jest.mock('../lib/couponlyPush',()=>({syncCouponlyPushToken:jest.fn(async()=>{})}));
jest.mock('../lib/couponlyBackend',()=>({sendCouponlyEmailCode:(...args:any[])=>mockSend(...args),verifyCouponlyEmailCode:async()=>{},completeCouponlySignup:(...args:any[])=>mockComplete(...args)}));
jest.mock('../components/onboarding/OnboardingUI',()=>{
 const React=require('react');const {View,Text,TextInput,Pressable}=require('react-native');
 return {OnboardingScaffold:({children,footer}:any)=>React.createElement(View,{},children,footer),OnboardingField:({label,...props}:any)=>React.createElement(TextInput,{accessibilityLabel:label,...props}),OnboardingPrimaryButton:({label,disabled,loading,onPress}:any)=>React.createElement(Pressable,{onPress,disabled:disabled||loading},React.createElement(Text,{},label)),OnboardingTextButton:({label,onPress}:any)=>React.createElement(Pressable,{onPress},React.createElement(Text,{},label)),InlineNotice:({children}:any)=>React.createElement(Text,{},children)};
});
async function profileStep(){
 const view=await render(<Signup/>);await fireEvent.changeText(view.getByLabelText('onboarding_email_placeholder'),'qa@rajagiri.edu.in');await fireEvent.changeText(view.getByLabelText('first_name_placeholder'),'QA');await fireEvent.changeText(view.getByLabelText('last_name_placeholder'),'Student');await fireEvent.press(view.getByText('onboarding_email_continue'));
 await waitFor(()=>expect(view.getByLabelText('Six-digit verification code')).toBeTruthy());await fireEvent.changeText(view.getByLabelText('Six-digit verification code'),'123456');
 await waitFor(()=>expect(view.getByText('onboarding_v2_success_preview')).toBeTruthy());return view;
}
beforeEach(()=>{mockSend.mockReset().mockResolvedValue(undefined);mockComplete.mockClear();mockClaim.mockReset();mockRefresh.mockClear();});afterEach(cleanup);
it('completes signup without an invite',async()=>{
 const view=await profileStep();expect(view.getByText('onboarding_v2_success_preview')).toBeTruthy();expect(mockClaim).not.toHaveBeenCalled();expect(mockComplete).toHaveBeenCalledWith(expect.objectContaining({accountRole:'student'}));
});
it('applies a normalized invite after verified signup',async()=>{
 mockClaim.mockResolvedValue({kind:'invite',status:'rewarded'});const view=await render(<Signup/>);await fireEvent.changeText(view.getByLabelText('onboarding_email_placeholder'),'qa@rajagiri.edu.in');await fireEvent.changeText(view.getByLabelText('first_name_placeholder'),'QA');await fireEvent.changeText(view.getByLabelText('last_name_placeholder'),'Student');await fireEvent.changeText(view.getByLabelText('Invite code (optional)'),'ab234');await fireEvent.press(view.getByText('onboarding_email_continue'));await fireEvent.changeText(await view.findByLabelText('Six-digit verification code'),'123456');
 await waitFor(()=>expect(mockClaim).toHaveBeenCalledWith('kouponly_claim_code',{p_code:'AB234',p_mutation_id:'signup-operation'}));await waitFor(()=>expect(view.getByText('onboarding_v2_success_preview')).toBeTruthy());
});
it('allows removing an invalid optional invite after signup profile was saved',async()=>{
 mockClaim.mockRejectedValue(Error('Invalid invite'));const view=await render(<Signup/>);await fireEvent.changeText(view.getByLabelText('onboarding_email_placeholder'),'qa@rajagiri.edu.in');await fireEvent.changeText(view.getByLabelText('first_name_placeholder'),'QA');await fireEvent.changeText(view.getByLabelText('last_name_placeholder'),'Student');await fireEvent.changeText(view.getByLabelText('Invite code (optional)'),'ZZZZZ');await fireEvent.press(view.getByText('onboarding_email_continue'));await fireEvent.changeText(await view.findByLabelText('Six-digit verification code'),'123456');await waitFor(()=>expect(view.getByText('Invalid invite')).toBeTruthy());expect(mockClaim).toHaveBeenCalledTimes(1);
});

it('rewards a personal invite during verified non-school signup',async()=>{
 mockClaim.mockResolvedValue({kind:'invite',status:'rewarded'});const view=await render(<Signup/>);await fireEvent.changeText(view.getByLabelText('onboarding_email_placeholder'),'student@gmail.com');await fireEvent.changeText(view.getByLabelText('first_name_placeholder'),'New');await fireEvent.changeText(view.getByLabelText('last_name_placeholder'),'Student');await fireEvent.changeText(view.getByLabelText('Invite code (optional)'),'AB234');await fireEvent.press(view.getByText('onboarding_email_continue'));await fireEvent.changeText(await view.findByLabelText('Six-digit verification code'),'123456');
 await waitFor(()=>expect(view.getByText('onboarding_v2_success_preview')).toBeTruthy());expect(mockComplete).toHaveBeenCalledWith(expect.objectContaining({email:'student@gmail.com'}));expect(mockClaim).toHaveBeenCalledWith('kouponly_claim_code',{p_code:'AB234',p_mutation_id:'signup-operation'});expect(view.queryByText('Your account is ready. Invite rewards are available to students with a verified @rajagiri.edu.in email.')).toBeNull();
});

it('pastes a copied OTP and persists signup contact fields', async () => {
 const clipboard = require('expo-clipboard');
 jest.spyOn(clipboard, 'getStringAsync').mockResolvedValue('123 456');
 const view = await render(<Signup/>);
 await fireEvent.changeText(view.getByLabelText('onboarding_email_placeholder'), 'student@example.com');
 await fireEvent.changeText(view.getByLabelText('first_name_placeholder'), 'New');
 await fireEvent.changeText(view.getByLabelText('last_name_placeholder'), 'Student');
 await fireEvent.changeText(view.getByLabelText('Date of birth (optional, YYYY-MM-DD)'), '2001-02-03');
 await fireEvent.changeText(view.getByLabelText('Phone number (optional)'), '+919876543210');
 await fireEvent.press(view.getByText('onboarding_email_continue'));
 await fireEvent.press(await view.findByText('Paste code'));
 await waitFor(() => expect(mockComplete).toHaveBeenCalledWith(expect.objectContaining({dob:'2001-02-03',phone:'+919876543210'})));
 expect(view.getByText('onboarding_v2_success_preview')).toBeTruthy();
 jest.restoreAllMocks();
});

it('explains waitlist restrictions and opens the waitlist form', async () => {
 mockSend.mockRejectedValueOnce(new Error('Signups not allowed for this instance'));
 const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
 const view = await render(<Signup/>);
 await fireEvent.changeText(view.getByLabelText('onboarding_email_placeholder'),'new@example.com');
 await fireEvent.changeText(view.getByLabelText('first_name_placeholder'),'New');
 await fireEvent.changeText(view.getByLabelText('last_name_placeholder'),'Student');
 await fireEvent.press(view.getByText('onboarding_email_continue'));
 await fireEvent.press(await view.findByText('Join the Kouponly waitlist'));
 expect(open).toHaveBeenCalledWith('https://kouponly.in/waitlist#waitlist-form');
 open.mockRestore();
});
it('shows the pre-launch welcome after a new signup', async () => {
 const alert = jest.spyOn(Alert, 'alert').mockImplementation(()=>{});
 await profileStep();
 expect(alert).toHaveBeenCalledWith('Welcome to Kouponly!',expect.stringContaining('pre-launch access'),expect.arrayContaining([expect.objectContaining({text:'Visit Kouponly'})]));
 alert.mockRestore();
});
