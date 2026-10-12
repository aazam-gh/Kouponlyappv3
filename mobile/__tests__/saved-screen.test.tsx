import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import SavedScreen from '../components/screens/saved-screen';
const mockToggle = jest.fn();
let mockHydrated = true;
let mockItems: any[] = [];
let mockOwner = 'alice';
const mockRefetch = jest.fn();
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useFocusEffect: (fn: any) => require('react').useEffect(fn, [fn]) }));
jest.mock('../lib/auth', () => ({ useAuth: () => ({ user: { id: mockOwner } }) }));
jest.mock('../lib/store', () => ({ useStore: () => ({ hydrated: mockHydrated, state: { saved: [1], savedOffers: [] }, cloudStatus: 'synced', toggleSaved: mockToggle, toggleSavedOffer: jest.fn(), notify: jest.fn(), retrySync: jest.fn() }) }));
jest.mock('../lib/catalogue', () => ({ useCatalogue: () => ({ status: 'cloud', error: '', refresh: jest.fn() }) }));
jest.mock('../lib/data', () => ({ deals: [{ id: 1, vendorId: 'vendor-1', name: 'Saved Cafe', category: 'Food', offers: [{ id: 'offer-1', index: 0, title: 'Free coffee' }], trend: 1, distanceKm: 1 }] }));
jest.mock('@tanstack/react-query', () => ({ useQuery: (options: any) => ({ refetch: mockRefetch, isFetching: false, isPending: false, isError: false, data: options.queryKey[1] === 'alice' ? { items: mockItems, offers: [{ id: 'offer-1', vendor_id: 'vendor-1', title: 'Free coffee' }], recent: [{ vendorId: 'retired-vendor', vendorName: 'Original vendor', redeemedAt: '2026-10-01' }] } : undefined }) }));
jest.mock('../context/AppThemeContext', () => ({ useAppTheme: () => ({ theme: { background: '#fff', text: '#000' } }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ bottom: 34 }) }));
jest.mock('../components/navigation/AppHeader', () => (props: any) => require('react').createElement(require('react-native').Text, null, props.title));
jest.mock('../components/RemoteImage', () => ({ RemoteImage: require('react-native').View }));
jest.mock('../components/StateSurface', () => ({ StateSurface: () => null }));
beforeEach(() => { mockOwner = 'alice'; mockHydrated = true; mockItems = []; jest.clearAllMocks(); });
test('shows saved offers, saved vendors, and historical names when a vendor leaves the catalogue', async () => {
  const view = await render(<SavedScreen />);
  expect(view.queryByText('Saved offers')).toBeNull();
  expect(view.getByText('Saved Cafe')).toBeTruthy();
  expect(view.getByText('Original vendor')).toBeTruthy();
  await fireEvent.press(view.getByLabelText('Remove Saved Cafe from saved'));
  expect(mockToggle).toHaveBeenCalledWith(1);
});
test('hides previous account content while the store hydrates', async () => {
  mockHydrated = false;
  const view = await render(<SavedScreen />);
  expect(view.queryByText('Saved Cafe')).toBeNull();
  expect(view.queryByText('Free coffee')).toBeNull();
  expect(view.queryByText('Original vendor')).toBeNull();
});

test('older saved offers are folded into a single vendor row', async () => {
  mockItems = [{ id: 'old-save', item_id: 'offer-1', item_type: 'offer', payload: { vendorId: 'vendor-1' } }];
  const view = await render(<SavedScreen />);
  expect(view.getAllByText('Saved Cafe')).toHaveLength(1);
  expect(view.queryByText('Saved offers')).toBeNull();
  expect(view.queryByText('Free coffee')).toBeNull();
});
