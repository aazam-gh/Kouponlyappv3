import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import AppLaunchPosterModal from '@/components/AppLaunchPosterModal';

const mockMaybeSingle = jest.fn();
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) }), rpc: mockRpc }),
}));

beforeEach(() => { mockMaybeSingle.mockReset(); mockRpc.mockReset().mockResolvedValue({ error: null }); jest.clearAllMocks(); });

it('shows an active poster once for a signed-in user and opens its configured vendor', async () => {
  mockMaybeSingle.mockResolvedValue({ data: { payload: { active: true, imageUrl: 'https://cdn.example.test/poster.webp', vendorId: 'vendor-123' } }, error: null });
  const screen = await render(<AppLaunchPosterModal userId="student-1" enabled />);
  const poster = await screen.findByLabelText('Open featured vendor');
  expect(screen.getByLabelText('Featured promotion')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Close poster'));
  await waitFor(() => expect(screen.queryByLabelText('Open featured vendor')).toBeNull());
  expect(router.push).not.toHaveBeenCalled();
  await screen.unmount();

  const reopened = await render(<AppLaunchPosterModal userId="student-1" enabled />);
  const reopenedPoster = await reopened.findByLabelText('Open featured vendor');
  fireEvent.press(reopenedPoster);
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/kouponly/vendor/vendor-123'));
  expect(mockRpc).toHaveBeenCalledWith('couponly_record_cms_click', { p_document_id: 'appLaunchPoster', p_item_id: 'appLaunchPoster' });
  await waitFor(() => expect(reopened.queryByLabelText('Open featured vendor')).toBeNull());
  expect(mockMaybeSingle).toHaveBeenCalledTimes(2);
});

it('records an external poster tap before opening its HTTPS destination', async () => {
  mockMaybeSingle.mockResolvedValue({ data: { payload: { active: true, imageUrl: 'https://cdn.example.test/poster.webp', destinationType: 'external', externalUrl: 'https://shop.example.test/deals' } }, error: null });
  const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
  const screen = await render(<AppLaunchPosterModal userId="student-1" enabled />);
  fireEvent.press(await screen.findByLabelText('Open featured website'));
  await waitFor(() => expect(openUrl).toHaveBeenCalledWith('https://shop.example.test/deals'));
  expect(mockRpc).toHaveBeenCalledWith('couponly_record_cms_click', { p_document_id: 'appLaunchPoster', p_item_id: 'appLaunchPoster' });
  openUrl.mockRestore();
});

it('does not fetch for signed-out users or display an inactive poster', async () => {
  const signedOut = await render(<AppLaunchPosterModal userId={null} enabled />);
  expect(mockMaybeSingle).not.toHaveBeenCalled();
  await signedOut.unmount();

  mockMaybeSingle.mockResolvedValue({ data: { payload: { active: false, imageUrl: 'https://cdn.example.test/poster.webp', vendorId: 'vendor-123' } }, error: null });
  const screen = await render(<AppLaunchPosterModal userId="student-1" enabled />);
  await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalledTimes(1));
  expect(screen.queryByLabelText('Open featured vendor')).toBeNull();
});

it('ignores active configs with an unsupported image URL', async () => {
  mockMaybeSingle.mockResolvedValue({ data: { payload: { active: true, imageUrl: 'javascript:alert(1)', vendorId: 'vendor-123' } }, error: null });
  const screen = await render(<AppLaunchPosterModal userId="student-1" enabled />);
  await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalledTimes(1));
  expect(screen.queryByLabelText('Open featured vendor')).toBeNull();
});
