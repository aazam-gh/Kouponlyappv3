import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
jest.mock('../context/AppThemeContext', () => ({ useAppTheme: () => ({ isDark: false, theme: { background:'#fff', card:'#fff', cardMuted:'#f1f4ef', border:'#e2e8e1', text:'#0a0f0c', mutedText:'#5f6861', subtleText:'#5f6861', brand:'#18b852', brandText:'#128a43', brandSoft:'#e8f8ed', actionSolid:'#0e7a38', onActionSolid:'#fff', inputPlaceholder:'#5f6861', danger:'#d92d20', info:'#2563eb', warning:'#b7791f' } }) }));
jest.mock('../context/LocaleContext', () => ({ useAppLocale: () => ({ locale:'en', isRTL:false }) }));
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const Native = require('react-native');
  const entering = { duration: () => entering, delay: () => entering, easing: () => entering, withInitialValues: () => entering, reduceMotion: () => entering };
  return {
    __esModule: true,
    default: { View: Native.View, Text: Native.Text },
    Easing: { out: (value: unknown) => value, inOut: (value: unknown) => value, cubic: 1, quad: 1, bezier: () => 1 },
    FadeInUp: entering,
    ReduceMotion: { System: 'system' },
    runOnJS: (fn: (...args: any[]) => void) => fn,
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
    useReducedMotion: () => true,
    useSharedValue: (value: unknown) => ({ value }),
    withDelay: (_delay: number, value: unknown) => value,
    withRepeat: (value: unknown) => value,
    withSequence: (...values: unknown[]) => values[values.length - 1],
    withSpring: (value: unknown) => value,
    withTiming: (value: unknown, _config?: unknown, callback?: (finished: boolean) => void) => { callback?.(true); return value; },
    interpolate: (value: number) => value,
  };
});
import AuthScreen from '../app/auth';
import OnboardingScreen from '../app/realx/onboarding';
import * as couponlyBackend from '../lib/couponlyBackend';

describe('Kouponly account onboarding entry', () => {
  it('offers student-only account creation', async () => {
    const view = await render(<SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:393,height:852},insets:{top:59,left:0,right:0,bottom:34}}}><AuthScreen/></SafeAreaProvider>);
    expect(view.getByText('BROKE?')).toBeTruthy();
    expect(view.getByText('Create account')).toBeTruthy();
    expect(view.getByText('Explore as Guest')).toBeTruthy();
    await fireEvent.press(view.getByText('Create account'));
    await waitFor(() => expect(view.getByText('Join as a student')).toBeTruthy());
    expect(view.queryByText('onboarding_join_as_creator')).toBeNull();
    await fireEvent.press(view.getByText('FOR STUDENTS'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/realx/onboarding', params: expect.objectContaining({ flow: 'signup', role: 'student' }) })));
  });
  it('uses the source email-code login flow with the Supabase-backed action', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ flow: 'login' } as any);
    const sendCode = jest.spyOn(couponlyBackend, 'sendCouponlyEmailCode').mockResolvedValue({ success: true, expiresIn: 60 } as any);
    const view = await render(<SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:393,height:852},insets:{top:59,left:0,right:0,bottom:34}}}><OnboardingScreen/></SafeAreaProvider>);
    expect(view.getByText('Send login code')).toBeTruthy();
    expect(view.queryByText('Password')).toBeNull();
    await fireEvent.changeText(view.getByLabelText('Email'), 'student@rajagiri.edu.in');
    await fireEvent.press(view.getByText('Send login code'));
    await waitFor(() => expect(sendCode).toHaveBeenCalledWith('student@rajagiri.edu.in', 'login'));
    expect(view.getByText('Check your email')).toBeTruthy();
    sendCode.mockRestore();
    jest.mocked(useLocalSearchParams).mockReturnValue({} as any);
  });
  it('labels signup codes as verification codes', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ flow: 'signup' } as any);
    const sendCode = jest.spyOn(couponlyBackend, 'sendCouponlyEmailCode').mockResolvedValue({ success: true, expiresIn: 60 } as any);
    const view = await render(<SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:393,height:852},insets:{top:59,left:0,right:0,bottom:34}}}><OnboardingScreen/></SafeAreaProvider>);
    await fireEvent.changeText(view.getByLabelText('Email address'), 'student@rajagiri.edu.in');
    await fireEvent.changeText(view.getByLabelText('First name'), 'Test');
    await fireEvent.changeText(view.getByLabelText('Last name'), 'Student');
    await fireEvent.press(view.getByText('Send Verification Code'));
    await waitFor(() => expect(sendCode).toHaveBeenCalledWith('student@rajagiri.edu.in', 'signup'));
    expect(view.getByText('Enter the verification code from your email.')).toBeTruthy();
    sendCode.mockRestore();
    jest.mocked(useLocalSearchParams).mockReturnValue({} as any);
  });
});
