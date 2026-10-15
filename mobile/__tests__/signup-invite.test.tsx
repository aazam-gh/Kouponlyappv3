import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import Signup from '../app/realx/onboarding';
const mockComplete=jest.fn(async(...args:unknown[])=>{void args;return {success:true};}); const mockClaim=jest.fn(); const mockRefresh=jest.fn(async()=>{});
jest.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key})}));
jest.mock('../lib/auth',()=>({useAuth:()=>({user:null,refreshStudentAccess:mockRefresh})}));
jest.mock('../lib/benefits',()=>({benefitsRpc:(...args:any[])=>mockClaim(...args),makeMutationId:()=> 'signup-operation'}));
jest.mock('../lib/supabase',()=>({getSupabase:()=>({auth:{getUser:async()=>({data:{user:{id:'qa-user'}}})}})}));
jest.mock('../lib/couponlyPush',()=>({syncCouponlyPushToken:jest.fn(async()=>{})}));
jest.mock('../lib/couponlyBackend',()=>({sendCouponlyEmailCode:async()=>{},verifyCouponlyEmailCode:async()=>{},completeCouponlySignup:(...args:any[])=>mockComplete(...args)}));
jest.mock('../components/onboarding/OnboardingUI',()=>{
 const React=require('react');const {View,Text,TextInput,Pressable}=require('react-native');
 return {OnboardingScaffold:({children,footer}:any)=>React.createElement(View,{},children,footer),OnboardingField:({label,...props}:any)=>React.createElement(TextInput,{accessibilityLabel:label,...props}),OnboardingPrimaryButton:({label,disabled,loading,onPress}:any)=>React.createElement(Pressable,{onPress,disabled:disabled||loading},React.createElement(Text,{},label)),OnboardingTextButton:({label,onPress}:any)=>React.createElement(Pressable,{onPress},React.createElement(Text,{},label)),InlineNotice:({children}:any)=>React.createElement(Text,{},children)};
});
async function profileStep(){
 const view=await render(<Signup/>);await fireEvent.changeText(view.getByLabelText('onboarding_email_placeholder'),'qa@rajagiri.edu.in');await fireEvent.changeText(view.getByLabelText('first_name_placeholder'),'QA');await fireEvent.changeText(view.getByLabelText('last_name_placeholder'),'Student');await fireEvent.press(view.getByText('onboarding_email_continue'));
 await waitFor(()=>expect(view.getByLabelText('Six-digit verification code')).toBeTruthy());await fireEvent.changeText(view.getByLabelText('Six-digit verification code'),'123456');
 await waitFor(()=>expect(view.getByText('onboarding_v2_success_preview')).toBeTruthy());return view;
}
beforeEach(()=>{mockComplete.mockClear();mockClaim.mockReset();mockRefresh.mockClear();});afterEach(cleanup);
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
