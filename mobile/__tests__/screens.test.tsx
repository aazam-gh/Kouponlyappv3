import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppThemeProvider } from '../context/AppThemeContext';
import { LocaleProvider } from '../context/LocaleContext';
import { queryClient } from '../utils/queryClient';
import { TabBarVisibilityProvider } from '../components/TabBarScrollVisibility';
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react-native';
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
  it('renders Top Brands before categories when the CMS order changes', async () => {
    const backend = require('../lib/backend');
    const { DEFAULT_HOME_SECTION_ORDER } = require('../lib/home-layout');
    backend.fetchCloudCatalogue.mockResolvedValueOnce({ ...require('../test/catalogue-fixture').fixture(), heroSlides: [], rewards: [], source: 'cloud', updatedAt: 0, homeSectionOrder: ['top-brands', ...DEFAULT_HOME_SECTION_ORDER.filter((id: string) => id !== 'top-brands')] });
    const view = await wrapper(<HomeScreen />);
    const flatten = (node: any): string => node == null ? '' : typeof node === 'string' ? node : Array.isArray(node) ? node.map(flatten).join('|') : flatten(node.children);
    await waitFor(() => {
      const content = flatten(view.toJSON());
      expect(content.indexOf('Top Brands')).toBeGreaterThanOrEqual(0);
      expect(content.indexOf('Top Brands')).toBeLessThan(content.indexOf('Food'));
    });
    await fireEvent.press(within(view.getByTestId('home-section-top-brands')).getByLabelText('Test Kitchen'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/realx/vendor/[id]', params: { id: 'vendor-1' } });
  });

  it('submits the home search query on Enter', async () => {
    const view = await wrapper(<HomeScreen />);
    expect(view.getByTestId('home-search')).toBeTruthy();
    await fireEvent.changeText(view.getByTestId('home-search'), '  lunch  ');
    await fireEvent(view.getByTestId('home-search'),'submitEditing');
    expect(router.push).toHaveBeenCalledWith({pathname:'/realx/search',params:{q:'lunch'}});
  });
  it('shows suggested vendors for an unmatched home search', async () => {
    const view = await wrapper(<HomeScreen />);
    const initialVendorCount = view.getAllByText('Test Kitchen').length;
    await fireEvent.changeText(view.getByTestId('home-search'), 'Missing restaurant');
    expect(view.queryByText('Can’t find it? Suggest a restaurant')).toBeNull();
    const suggestedVendors = view.getAllByText('Test Kitchen');
    expect(suggestedVendors).toHaveLength(initialVendorCount + 1);
    await fireEvent.press(suggestedVendors[suggestedVendors.length - 1]);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/realx/vendor/[id]', params: { id: 'vendor-1' } });
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
    expect(view.queryByLabelText('Suggest a restaurant')).toBeNull();
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
  it('labels the saved vendor section Saved Discounts for guest users', async () => {
    const view = await wrapper(<SavedScreen />);
    await waitFor(() => expect(view.getByText('Sign in to sync saved vendors across devices.')).toBeTruthy());
    expect(view.getByText('Saved Discounts')).toBeTruthy();
    expect(view.queryByText('Saved Vendors')).toBeNull();
    expect(view.getByText('Redemption History')).toBeTruthy();
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
