import React from 'react';
import { Linking, Share } from 'react-native';
import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DealDetail from '../app/deal/[id]';
import { AppThemeProvider } from '../context/AppThemeContext';
import { LocaleProvider } from '../context/LocaleContext';

const mockPush = jest.fn();
const mockNotify = jest.fn();
const mockToggleSavedOffer = jest.fn();
let mockBenefits: any = null;
const mockDeal: any = {
  id: 1, vendorId: 'vendor-1', name: 'Vendor', category: 'Food', image: 'cover.jpg', logo: 'logo.jpg',
  description: 'About the vendor', externalUrl: 'vendor.example', instagramUrl: '@vendor', phoneNumber: '+91 12345',
  offers: [0, 1].map(index => ({ id: `offer-${index}`, index, title: `Promo ${index}`, description: 'Offer details', redemption: 'inStore' })),
};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '1' }), useRouter: () => ({ push: mockPush }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]),
}));
jest.mock('../lib/nearby', () => ({ useNearbyDistances: () => ({ distanceByVendor: new Map() }) }));
jest.mock('../lib/catalogue', () => ({ useCatalogue: () => ({ status: 'cloud' }) }));
jest.mock('../lib/auth', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../lib/benefits', () => ({ useBenefits: () => ({ benefits: mockBenefits }), isCouponOfferUsed: (benefits: any, offerId: string, vendorId?: string | null) => Array.isArray(benefits?.usedOfferIds) ? benefits.usedOfferIds.includes(offerId) : Boolean(vendorId && benefits?.usedVendorIds?.includes(vendorId)) }));
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
  mockDeal.externalUrl = 'vendor.example';
  mockDeal.instagramUrl = '@vendor';
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction });
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); });

it('shares a link to this vendor and opens normalized contact links', async () => {
  const view = await screen();
  await fireEvent.press(view.getByLabelText('Share vendor'));
  expect(Share.share).toHaveBeenCalledWith({ message: 'Vendor on Kouponly\nkouponly://realx/vendor/vendor-1' });
  await fireEvent.press(view.getByLabelText('More information about Vendor'));
  await fireEvent.press(view.getByLabelText('Vendor website'));
  expect(Linking.openURL).toHaveBeenCalledWith('https://vendor.example/');
  await fireEvent.press(view.getByLabelText('Vendor Instagram'));
  expect(Linking.openURL).toHaveBeenCalledWith('https://www.instagram.com/vendor/');
  await fireEvent.press(view.getByLabelText('Call +91 12345'));
  expect(Linking.openURL).toHaveBeenCalledWith('tel:+9112345');
});

it('hides invalid links and reports an external-link failure', async () => {
  mockDeal.externalUrl = 'javascript:alert(1)';
  mockDeal.instagramUrl = 'https://unrelated.example/';
  const view = await screen();
  expect(view.queryByLabelText('Vendor website')).toBeNull();
  expect(view.queryByLabelText('Vendor Instagram')).toBeNull();
  jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error('Unable to open'));
  await fireEvent.press(view.getByLabelText('Call +91 12345'));
  expect(mockNotify).toHaveBeenCalledWith('Unable to open this link. Please try again.');
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
