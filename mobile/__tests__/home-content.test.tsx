import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useHomeContent } from '@/utils/useHomeContent';
import { queryClient } from '@/utils/queryClient';

const mockCategories = jest.fn();
const mockEditorial = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getPublicSupabase: () => ({
    from: () => ({ select: () => ({
      eq: () => ({ order: () => ({ abortSignal: mockCategories }) }),
      in: () => ({ abortSignal: mockEditorial }),
    }) }),
  }),
}));

const categoryKey = 'kouponly.home.categories.v1';
const editorialKey = 'kouponly.home.editorial.v1';

function Probe() {
  const { categories, editorial } = useHomeContent();
  return <>
    <Text>{categories.data?.[0]?.name ?? 'No category'}</Text>
    <Text>{editorial.data?.order.join(',') ?? 'No layout'}</Text>
  </>;
}
const showHome = () => render(<QueryClientProvider client={queryClient}><Probe /></QueryClientProvider>);
beforeEach(async () => { await AsyncStorage.clear(); queryClient.clear(); jest.clearAllMocks(); });
afterEach(() => { cleanup(); queryClient.clear(); });

it('stores the public home data and restores it while a failed refresh is pending', async () => {
  mockCategories.mockResolvedValueOnce({ data: [{ id: 'food', name: 'Food', image_path: '' }], error: null });
  mockEditorial.mockResolvedValueOnce({ data: [{ id: 'homeLayout', payload: { enabledSections: ['categories'] } }], error: null });
  const online = await showHome();
  await online.findByText('Food');
  await waitFor(async () => expect(await AsyncStorage.getItem(editorialKey)).toContain('categories'));
  await online.unmount();
  queryClient.clear();

  mockCategories.mockResolvedValue({ error: new Error('Offline') });
  mockEditorial.mockResolvedValue({ error: new Error('Offline') });
  const offline = await showHome();
  await offline.findByText('Food');
  await offline.findByText('categories');
  await waitFor(() => expect(mockCategories).toHaveBeenCalledTimes(2));
  expect(offline.getByText('Food')).toBeTruthy();
});

it('discards expired and malformed snapshots', async () => {
  await AsyncStorage.setItem(categoryKey, JSON.stringify({ savedAt: Date.now() - 25 * 3600_000, data: [{ id: 'old', name: 'Expired food' }] }));
  await AsyncStorage.setItem(editorialKey, 'broken json');
  mockCategories.mockResolvedValue({ error: new Error('Offline') });
  mockEditorial.mockResolvedValue({ error: new Error('Offline') });
  const view = await showHome();
  await waitFor(() => expect(mockEditorial).toHaveBeenCalled());
  expect(view.queryByText('Expired food')).toBeNull();
  expect(view.getByText('No layout')).toBeTruthy();
});
