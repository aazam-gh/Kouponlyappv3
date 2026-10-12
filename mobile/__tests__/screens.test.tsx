import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppThemeProvider } from '../context/AppThemeContext';
import { LocaleProvider } from '../context/LocaleContext';
import { queryClient } from '../utils/queryClient';
import { TabBarVisibilityProvider } from '../components/TabBarScrollVisibility';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider } from '../lib/store';
import VendorSearchScreen from '../app/realx/search';
import HomeScreen from '../app/(tabs)/index';
import SavedScreen from '../components/screens/saved-screen';
import WorkScreen from '../app/work';
import { router } from 'expo-router';
import { loadFixture, clearFixture } from '../test/catalogue-fixture';
import { CatalogueProvider } from '../lib/catalogue';
import { NearbyProvider } from '../lib/nearby';
import { RedemptionSheet } from '../components/RedemptionSheet';
import * as couponlyBackend from '../lib/couponlyBackend';
import { getPendingVerification, savePendingVerification } from '../lib/verification-pending';

jest.mock('posthog-react-native', () => ({usePostHog: () => ({capture: jest.fn()})}));

jest.mock('../lib/backend',()=>({...jest.requireActual('../lib/backend'),fetchCloudCatalogue:jest.fn(async()=>({...jest.requireActual('../test/catalogue-fixture').fixture(),heroSlides:[],rewards:[],source:'cloud',updatedAt:0})),subscribeToCatalogue:()=>({unsubscribe:jest.fn()})}));
jest.mock('expo-location',()=>({getForegroundPermissionsAsync:jest.fn(async()=>({status:'denied',canAskAgain:false}))}));
beforeEach(loadFixture);
const frame = { x: 0, y: 0, width: 393, height: 852 };
const wrapper = (node: React.ReactNode) => render(<SafeAreaProvider initialMetrics={{ frame, insets: { top: 59, left: 0, right: 0, bottom: 34 } }}><AppThemeProvider><LocaleProvider><TabBarVisibilityProvider><QueryClientProvider client={queryClient}><CatalogueProvider><NearbyProvider><StoreProvider>{node}</StoreProvider></NearbyProvider></CatalogueProvider></QueryClientProvider></TabBarVisibilityProvider></LocaleProvider></AppThemeProvider></SafeAreaProvider>);
afterEach(async () => { cleanup(); queryClient.clear(); clearFixture(); await AsyncStorage.clear(); });

describe('mobile showcase states', () => {
  it('submits the home search query on Enter', async () => {
    const view = await wrapper(<HomeScreen />);
    expect(view.getByTestId('home-search')).toBeTruthy();
    await fireEvent.changeText(view.getByTestId('home-search'), '  lunch  ');
    await fireEvent(view.getByTestId('home-search'),'submitEditing');
    expect(router.push).toHaveBeenCalledWith({pathname:'/realx/search',params:{q:'lunch'}});
  });
  it('returns Home to the top when its tab is pressed', async () => {
    const listeners = new Map<string, () => void>();
    const navigation = jest.spyOn(require('expo-router'), 'useNavigation').mockReturnValue({ addListener: (event: string, callback: () => void) => { listeners.set(event, callback); return () => {}; } } as any);
    try {
      const view = await wrapper(<HomeScreen />);
      await fireEvent.changeText(view.getByTestId('home-search'), 'Rice');
      await act(async () => listeners.get('tabPress')?.());
      expect(listeners.has('tabPress')).toBe(true);
      expect(view.getByTestId('home-search').props.value).toBe('');
    } finally { navigation.mockRestore(); }
  });
  it('uses the source image-card search results and popular recommendations', async () => {
    const view = await wrapper(<VendorSearchScreen />);
    const input = view.getByTestId('vendor-search-input');
    await fireEvent.changeText(input, 'Rice');
    expect(view.getByLabelText('Test Kitchen')).toBeTruthy();
    await fireEvent(input, 'submitEditing');
    expect(view.getByLabelText('Test Kitchen')).toBeTruthy();
    await fireEvent.changeText(input, 'no matching partner');
    await fireEvent(input, 'submitEditing');
    await waitFor(() => expect(view.getByText('Popular offers for you')).toBeTruthy());
    expect(view.getByLabelText('Test Kitchen')).toBeTruthy();
  });
  it('shows database main categories on Home', async () => {
    const view = await wrapper(<HomeScreen />);
    await waitFor(() => expect(view.getByLabelText('Food')).toBeTruthy());
    expect(view.getByLabelText('Stays')).toBeTruthy();
  });
  it('shows and opens the pending verification banner from stored Supabase request state', async () => {
    jest.spyOn(couponlyBackend, 'getCouponlyVerificationStatus').mockResolvedValue({ status: 'pending', requestId: 'request-1', rejectionReason: null, role: 'student' });
    await savePendingVerification({ email: 'student@example.edu', role: 'student', requestId: 'request-1', statusToken: 'status-token' });
    expect(await getPendingVerification()).toMatchObject({ requestId: 'request-1' });
    const view = await wrapper(<HomeScreen />);
    await waitFor(() => expect(view.getByText('Verification in Progress')).toBeTruthy());
    await fireEvent.press(view.getByText('Verification in Progress'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/realx/onboarding', params: { flow: 'verification', step: 'status', requestId: 'request-1', statusToken: 'status-token' } });
  });
  it('keeps guest users in Saved with a sign-in option and recommendations', async () => {
    const view = await wrapper(<SavedScreen />);
    await waitFor(() => expect(view.getByText('Sign in to sync saved vendors across devices.')).toBeTruthy());
    expect(view.getByText('Recommended for you')).toBeTruthy();
    expect(view.getByText('Last redeemed vendors')).toBeTruthy();
  });
  it('routes the legacy work link to the source Explore map', async () => {
    await wrapper(<WorkScreen />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/realx/map'));
  });
  it.each(['online','inStore'] as const)('requires sign-in for %s redemption', async (mode) => {
    const view = await wrapper(<RedemptionSheet visible id="deal-101-1" title="Test Kitchen" mode={mode} onClose={jest.fn()}/>);
    await waitFor(()=>expect(view.getByText('Sign in to redeem')).toBeTruthy());
    expect(view.queryByTestId('confirm-redemption')).toBeNull();
    expect(view.queryByPlaceholderText(/PIN/)).toBeNull();
  });
});
