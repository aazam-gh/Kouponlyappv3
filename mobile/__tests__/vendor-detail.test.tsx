import React from 'react';
import { Alert, Linking, Share } from 'react-native';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DealDetail from '../app/deal/[id]';
import { AppThemeProvider } from '../context/AppThemeContext';
import { LocaleProvider } from '../context/LocaleContext';

jest.mock('expo-device', () => ({ isDevice: true }));
const mockPush = jest.fn();
const mockNotify = jest.fn();
const mockToggleSavedOffer = jest.fn();
let mockBenefits: any = null;
let mockDistances = new Map();
const mockDeal: any = {
  id: 1, vendorId: 'vendor-1', name: 'Vendor', category: 'Food', image: 'cover.jpg', logo: 'logo.jpg',
  description: 'About the vendor', externalUrl: 'vendor.example', instagramUrl: '@vendor', phoneNumber: '+91 12345',
  offers: [0, 1].map(index => ({ id: `offer-${index}`, index, title: `Promo ${index}`, description: 'Offer details', redemption: 'inStore' })),
};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '1' }), useRouter: () => ({ push: mockPush }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]),
}));
jest.mock('../lib/nearby', () => ({ useNearbyDistances: () => ({ distanceByVendor: mockDistances }) }));
jest.mock('../lib/catalogue', () => ({ useCatalogue: () => ({ status: 'cloud' }) }));
jest.mock('../lib/auth', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../lib/benefits', () => ({ useBenefits: () => ({ benefits: mockBenefits }), isCouponOfferUsed: jest.requireActual('../lib/benefits').isCouponOfferUsed }));
jest.mock('../lib/store', () => ({ useStore: () => ({
  state: { saved: [], savedOffers: [] }, notify: mockNotify, toggleSaved: jest.fn(), toggleSavedOffer: mockToggleSavedOffer,
}) }));
jest.mock('posthog-react-native', () => ({ usePostHog: () => ({ capture: jest.fn() }) }));
jest.mock('../lib/data', () => ({ dealById: () => mockDeal }));
const screen = () => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, bottom: 34, left: 0, right: 0 } }}>
    <AppThemeProvider><LocaleProvider><DealDetail /></LocaleProvider></AppThemeProvider>
  </SafeAreaProvider>,
);
beforeEach(() => {
  jest.clearAllMocks();
  mockBenefits = null;
  mockDistances = new Map();
  mockDeal.offers = [0, 1].map(index => ({ id: `offer-${index}`, index, title: `Promo ${index}`, description: 'Offer details', redemption: 'inStore' }));
  mockDeal.externalUrl = 'vendor.example';
  mockDeal.instagramUrl = '@vendor';
  mockDeal.vendorInformation = undefined;
  mockDeal.openingHours = undefined;
  mockDeal.locations = undefined;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction });
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); });

it('shares a link to this vendor and opens normalized contact links', async () => {
  const view = await screen();
  await fireEvent.press(view.getByLabelText('Share vendor'));
  expect(Share.share).toHaveBeenCalledWith({ message: 'Vendor on Kouponly\nhttps://kouponly.in/vendor/vendor-1' });
  await fireEvent.press(view.getByLabelText('More information about Vendor'));
  await fireEvent.press(view.getByLabelText('Vendor website'));
  expect(Linking.openURL).toHaveBeenCalledWith('https://vendor.example/');
  await fireEvent.press(view.getByLabelText('Vendor Instagram'));
  expect(Linking.openURL).toHaveBeenCalledWith('https://www.instagram.com/vendor/');
  await fireEvent.press(view.getByLabelText('Call +91 12345'));
  await waitFor(() => expect(Linking.openURL).toHaveBeenCalledWith('tel:+9112345'));
});

it('shows vendor information in a dismissible bottom sheet', async () => {
  mockDeal.vendorInformation = { title: 'Good to know', message: 'Walk-ins are welcome.' };
  mockDeal.openingHours = 'Monday to Saturday, 9 AM to 9 PM';
  mockDeal.locations = [{ id: 'branch-1', name: 'Main branch', address: '123 Market Street' }];
  const view = await screen();

  await fireEvent.press(view.getByLabelText('More information about Vendor'));
  expect(view.getByTestId('vendor-info-modal').props.animationType).toBe('none');
  expect(view.getByTestId('vendor-info-backdrop')).toHaveStyle({ flex: 1, backgroundColor: 'rgba(0,0,0,.42)' });
  expect(view.getByTestId('vendor-info-sheet').props.entering).toBeDefined();
  expect(view.getByLabelText('Close store information')).toBeTruthy();
  expect(view.getByLabelText('Vendor website')).toBeTruthy();
  expect(view.getByLabelText('Vendor Instagram')).toBeTruthy();
  expect(view.getByText('Store timings')).toBeTruthy();
  expect(view.getByText('Good to know')).toBeTruthy();
  expect(view.getByText('About Vendor')).toBeTruthy();
  expect(view.getByText('Address')).toBeTruthy();
  expect(view.getByText('123 Market Street')).toBeTruthy();

  await fireEvent.press(view.getByLabelText('Close store information'));
  expect(view.queryByText('Store timings')).toBeNull();

  await fireEvent.press(view.getByLabelText('More information about Vendor'));
  await fireEvent.press(view.getByTestId('vendor-info-backdrop'));
  expect(view.queryByText('Store timings')).toBeNull();
});

it('hides invalid links and reports an external-link failure', async () => {
  mockDeal.externalUrl = 'javascript:alert(1)';
  mockDeal.instagramUrl = 'https://unrelated.example/';
  const view = await screen();
  expect(view.queryByLabelText('Vendor website')).toBeNull();
  expect(view.queryByLabelText('Vendor Instagram')).toBeNull();
  jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error('Unable to open'));
  await fireEvent.press(view.getByLabelText('Call +91 12345'));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Call unavailable', '+91 12345'));
});

it('opens offer details from the promo title', async () => {
  const view = await screen();
  await fireEvent.press(view.getByLabelText('Show details for Promo 1'));
  expect(view.getAllByText('Offer details')).toHaveLength(2);
});

it('saves a particular offer', async () => {
  const view = await screen();
  await fireEvent.press(view.getByLabelText('Save Promo 1'));
  expect(mockToggleSavedOffer).toHaveBeenCalledWith('offer-1');
});

it('hides the coupon limit copy and availability before benefits load', async () => {
  const view = await screen();
  expect(view.queryByText(/Coupon limit: 1 per vendor per round, shared across all promos/i)).toBeNull();
  expect(view.queryByLabelText('Coupons remaining: 1 of 1')).toBeNull();
});

it('tracks coupon availability independently for each offer', async () => {
  mockBenefits = { subscription: { roundId: 'round-1' }, usedOfferIds: ['offer-0'], usedVendorIds: ['vendor-1'] };
  const view = await screen();
  expect(view.getByLabelText('Coupons remaining: 0 of 1')).toBeTruthy();
  expect(view.getByTestId('redeem-offer-0')).toBeDisabled();
  expect(view.getByLabelText('Coupons remaining: 1 of 1')).toBeTruthy();
  expect(view.getByTestId('redeem-offer-1')).toBeEnabled();
});


it('opens the nearest branch and switches between its coupons without changing offer indexes', async () => {
  mockDeal.locations = [
    { id: 'vendor-1:kochi', branchId: 'kochi', name: 'Kochi', address: 'Kochi address' },
    { id: 'vendor-1:tvm', branchId: 'tvm', name: 'TVM', address: 'TVM address' },
  ];
  mockDeal.offers[0].branchIds = ['kochi'];
  mockDeal.offers[1].branchIds = ['tvm'];
  mockDistances.set('vendor-1', { location: { locationId: 'vendor-1:tvm' }, label: '0.10 km' });
  const view = await screen();
  expect(view.getByText('Offers at TVM')).toBeTruthy();
  expect(view.getByText('Promo 1')).toBeTruthy();
  expect(view.queryByText('Promo 0')).toBeNull();
  await fireEvent.press(view.getByTestId('redeem-offer-1'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/redeem/[id]', params: { id: '1', vendorId: 'vendor-1', offerIndex: '1', branch: 'vendor-1:tvm' } });
  await fireEvent.press(view.getByLabelText('Select Kochi'));
  expect(view.getByText('Promo 0')).toBeTruthy();
  expect(view.queryByText('Promo 1')).toBeNull();
});

it('shows an empty state when the selected branch has no coupon', async () => {
  mockDeal.locations = [{ id: 'kochi', name: 'Kochi' }, { id: 'tvm', name: 'TVM' }];
  mockDeal.offers.forEach((offer: any) => { offer.branchIds = ['kochi']; });
  const view = await screen();
  await fireEvent.press(view.getByLabelText('Select TVM'));
  expect(view.getByText('No coupons available at this branch. Choose another branch to see its offers.')).toBeTruthy();
  expect(view.queryByTestId('redeem-offer-0')).toBeNull();
});

it('omits branch controls and branch labels for a single-location vendor', async () => {
  mockDeal.locations = [{ id: 'kochi', name: 'Kochi', address: 'Kochi address' }];
  const view = await screen();
  expect(view.queryByText('Offers at Kochi')).toBeNull();
  expect(view.queryByLabelText('Select Kochi')).toBeNull();
  expect(view.queryByText('Kochi')).toBeNull();
  expect(view.getByText('Promo 0')).toBeTruthy();
});

it('uses a separate coupon for the same offer at each branch', async () => {
  mockDeal.locations = [{ id: 'vendor-1:a', branchId: 'a', name: 'Branch A' }, { id: 'vendor-1:b', branchId: 'b', name: 'Branch B' }];
  mockDeal.offers = [mockDeal.offers[0]];
  mockBenefits = { subscription: { roundId: 'round-1', endsAt: '2026-12-01' }, usedOfferIds: ['offer-0'], usedVendorIds: ['vendor-1'], usedOfferBranches: [{ offerId: 'offer-0', branchId: 'a' }] };
  const view = await screen();
  expect(view.getByTestId('redeem-offer-0')).toBeDisabled();
  await fireEvent.press(view.getByLabelText('Select Branch B'));
  expect(view.getByTestId('redeem-offer-0')).toBeEnabled();
  expect(view.getByLabelText('Coupons remaining: 1 of 1')).toBeTruthy();
});

it('keeps an exhausted offer visible but disables redemption independently of personal usage', async () => {
  mockDeal.offers[0].redemptionLimit = 100;
  mockDeal.offers[0].redemptionCount = 100;
  const view = await screen();
  expect(view.getByText('Fully redeemed · All available coupons have been used.')).toBeTruthy();
  expect(view.getByTestId('redeem-offer-0')).toBeDisabled();
  expect(view.getByTestId('redeem-offer-1')).toBeEnabled();
});
