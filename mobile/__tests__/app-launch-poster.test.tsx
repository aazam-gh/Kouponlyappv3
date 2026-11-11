import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import HomeLaunchPromotion from '@/components/home/HomeLaunchPromotion';

const mockMaybeSingle = jest.fn();
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getPublicSupabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) }) }),
  getSupabase: () => ({ rpc: mockRpc }),
}));
jest.mock('@/components/ScalePressable', () => require('react-native').Pressable);

const showPromotion = (payload: unknown) => {
  mockMaybeSingle.mockResolvedValue({ data: { payload }, error: null });
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  return render(<QueryClientProvider client={client}><HomeLaunchPromotion /></QueryClientProvider>);
};

beforeEach(() => { mockMaybeSingle.mockReset(); mockRpc.mockReset().mockResolvedValue({ error: null }); jest.clearAllMocks(); });

it('renders the promotion inline and opens its configured vendor even if tracking stalls', async () => {
  mockRpc.mockReturnValue(new Promise(() => {}));
  const screen = await showPromotion({ active: true, imageUrl: 'https://cdn.example.test/poster.webp', vendorId: 'vendor-123' });
  await fireEvent.press(await screen.findByLabelText('Featured promotion'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/kouponly/vendor/[id]', params: { id: 'vendor-123' } });
  expect(mockRpc).toHaveBeenCalledWith('couponly_record_cms_click', { p_document_id: 'appLaunchPoster', p_item_id: 'appLaunchPoster' });
});

it('opens the configured HTTPS destination', async () => {
  const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
  const screen = await showPromotion({ active: true, imageUrl: 'https://cdn.example.test/poster.webp', destinationType: 'external', externalUrl: 'https://shop.example.test/deals' });
  await fireEvent.press(await screen.findByLabelText('Featured promotion'));
  expect(openUrl).toHaveBeenCalledWith('https://shop.example.test/deals');
  openUrl.mockRestore();
});

it.each([
  { active: false, imageUrl: 'https://cdn.example.test/poster.webp' },
  { active: true, imageUrl: 'javascript:alert(1)' },
])('hides an inactive promotion or unsupported image URL', async payload => {
  const screen = await showPromotion({ ...payload, vendorId: 'vendor-123' });
  await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalledTimes(1));
  expect(screen.queryByLabelText('Featured promotion')).toBeNull();
});
