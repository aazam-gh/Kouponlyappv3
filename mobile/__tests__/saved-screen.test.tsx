import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import SavedScreen from '../components/screens/saved-screen';
const mockToggle = jest.fn((id: number) => { mockSavedState.saved = mockSavedState.saved.filter(savedId => savedId !== id); });
const mockToggleOffer = jest.fn((id: string) => { mockSavedState.savedOffers = mockSavedState.savedOffers.filter(savedId => savedId !== id); });
const mockDeleteIn = jest.fn(async () => ({ error: null }));
let mockHydrated = true;
let mockItems: any[] = [];
let mockOwner = 'alice';
const mockSavedState = { saved: [1] as number[], savedOffers: [] as string[] };
const mockRefetch = jest.fn();
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useFocusEffect: (fn: any) => require('react').useEffect(fn, [fn]) }));
jest.mock('../lib/auth', () => ({ useAuth: () => ({ user: { id: mockOwner } }) }));
jest.mock('../lib/store', () => ({ useStore: () => ({ hydrated: mockHydrated, state: mockSavedState, cloudStatus: 'synced', toggleSaved: mockToggle, toggleSavedOffer: mockToggleOffer, notify: jest.fn(), retrySync: jest.fn() }) }));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ from: () => ({ delete: () => ({ eq: () => ({ in: mockDeleteIn }) }) }) }) }));
jest.mock('../lib/catalogue', () => ({ useCatalogue: () => ({ status: 'cloud', error: '', refresh: jest.fn() }) }));
jest.mock('../lib/data', () => ({ deals: [{ id: 1, vendorId: 'vendor-1', name: 'Saved Cafe', category: 'Food', offers: [{ id: 'offer-1', index: 0, title: 'Free coffee' }], trend: 1, distanceKm: 1 }] }));
jest.mock('@tanstack/react-query', () => ({ useQuery: (options: any) => ({ refetch: mockRefetch, isFetching: false, isPending: false, isError: false, data: options.queryKey[1] === 'alice' ? { items: mockItems, offers: [{ id: 'offer-1', vendor_id: 'vendor-1', title: 'Free coffee' }], recent: [{ vendorId: 'retired-vendor', vendorName: 'Original vendor', redeemedAt: '2026-10-01' }] } : undefined }) }));
jest.mock('../context/AppThemeContext', () => ({ useAppTheme: () => ({ theme: { background: '#fff', text: '#000' } }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ bottom: 34 }) }));
jest.mock('../components/navigation/AppHeader', () => (props: any) => require('react').createElement(require('react-native').Text, null, props.title));
jest.mock('../components/RemoteImage', () => ({ RemoteImage: require('react-native').View }));
jest.mock('../components/StateSurface', () => ({ StateSurface: () => null }));
beforeEach(() => { mockOwner = 'alice'; mockHydrated = true; mockItems = []; mockSavedState.saved = [1]; mockSavedState.savedOffers = []; jest.clearAllMocks(); });
test('shows saved offers, saved vendors, and historical names when a vendor leaves the catalogue', async () => {
  const view = await render(<SavedScreen />);
  expect(view.queryByText('Saved offers')).toBeNull();
  expect(view.getByText('Saved Cafe')).toBeTruthy();
  expect(view.getByText(/Original vendor/)).toBeTruthy();
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
  mockSavedState.saved = [];
  mockItems = [{ id: 'old-save', item_id: 'offer-1', item_type: 'offer', payload: { vendorId: 'vendor-1' } }];
  const view = await render(<SavedScreen />);
  expect(view.getAllByText('Saved Cafe')).toHaveLength(1);
  expect(view.queryByText('Saved offers')).toBeNull();
  expect(view.queryByText('Free coffee')).toBeNull();
});

test('shows the associated vendor when an offer is saved in the account store', async () => {
  mockSavedState.saved = [];
  mockSavedState.savedOffers = ['offer-1'];
  const view = await render(<SavedScreen />);
  expect(view.getByText('Saved Cafe')).toBeTruthy();
});

test('removing a saved vendor clears its vendor and offer saves and refreshes the list', async () => {
  mockSavedState.saved = [1];
  mockSavedState.savedOffers = ['offer-1'];
  mockItems = [
    { id: 'vendor-save', item_id: 'vendor-1', item_type: 'vendor', payload: {} },
    { id: 'offer-save', item_id: 'offer-1', item_type: 'offer', payload: { vendorId: 'vendor-1' } },
  ];
  const view = await render(<SavedScreen />);
  expect(view.getByText('Saved Cafe')).toBeTruthy();

  await fireEvent.press(view.getByLabelText('Remove Saved Cafe from saved'));

  expect(mockDeleteIn).toHaveBeenCalledWith('id', ['vendor-save', 'offer-save']);
  expect(mockToggle).toHaveBeenCalledWith(1);
  expect(mockToggleOffer).toHaveBeenCalledWith('offer-1');
  expect(mockSavedState.saved).not.toContain(1);
  expect(mockSavedState.savedOffers).not.toContain('offer-1');
  expect(mockRefetch).toHaveBeenCalled();
});
