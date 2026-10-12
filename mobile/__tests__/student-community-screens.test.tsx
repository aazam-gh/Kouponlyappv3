import React from 'react';
import { AppThemeProvider } from '../context/AppThemeContext';
import { LocaleProvider } from '../context/LocaleContext';
import { fireEvent, render, waitFor, cleanup } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import StudentRequestScreen from '../app/student-request';
import FriendsScreen from '../app/friends';
import { communityRpc, submitStudentRequest } from '../lib/student-community';

jest.mock('../lib/auth', () => ({ useAuth: () => ({ user: { id: 'student-1', email: 'student@rajagiri.edu.in' } }) }));
jest.mock('../lib/benefits', () => ({ useBenefits: () => ({ benefits: { inviteCode: 'ABCDE' } }) }));
jest.mock('../lib/backend', () => ({ makeMutationId: () => 'request-uuid' }));
jest.mock('../lib/student-community', () => ({ communityRpc: jest.fn(), submitStudentRequest: jest.fn() }));
const clients: QueryClient[] = [];
const wrap = (screen: React.ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  return render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, bottom: 34, left: 0, right: 0 } }}><AppThemeProvider><LocaleProvider><QueryClientProvider client={client}>{screen}</QueryClientProvider></LocaleProvider></AppThemeProvider></SafeAreaProvider>);
};
beforeEach(() => { (useLocalSearchParams as jest.Mock).mockReturnValue({ kind: 'school' }); jest.clearAllMocks(); });
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });
it('retains school details on a failed save and retries the same request before showing success', async () => {
  (submitStudentRequest as jest.Mock).mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce(undefined);
  const view = await wrap(<StudentRequestScreen />);
  await fireEvent.changeText(view.getByLabelText('Institute name (required)'), 'Marina University');
  await fireEvent.changeText(view.getByLabelText('Student email domain (required)'), 'marina.edu');
  await fireEvent.press(view.getByLabelText('Submit request'));
  await waitFor(() => expect(view.getByText('Connection lost')).toBeTruthy());
  expect(view.getByLabelText('Institute name (required)').props.value).toBe('Marina University');
  await fireEvent.press(view.getByLabelText('Submit request'));
  await waitFor(() => expect(view.getByText('Request submitted')).toBeTruthy());
  expect((submitStudentRequest as jest.Mock).mock.calls[0]).toEqual((submitStudentRequest as jest.Mock).mock.calls[1]);
});
it('submits a restaurant request without manager or phone details', async () => {
  (useLocalSearchParams as jest.Mock).mockReturnValue({ kind: 'restaurant' });
  (submitStudentRequest as jest.Mock).mockResolvedValue(undefined);
  const view = await wrap(<StudentRequestScreen />);
  await fireEvent.changeText(view.getByLabelText('Restaurant name (required)'), 'Marina Cafe');
  await fireEvent.press(view.getByLabelText('Submit request'));
  await waitFor(() => expect(submitStudentRequest).toHaveBeenCalledWith(expect.objectContaining({ kind: 'restaurant', name: 'Marina Cafe', contact: '', phone: '' }), 'request-uuid'));
});
it('lets a student retry loading friends and explicitly accept an incoming request', async () => {
  const snapshot = { shareActivity: false, activity: [], friends: [{ id: 'friend-1', name: 'Bob', status: 'pending', incoming: true }] };
  (communityRpc as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
  const view = await wrap(<FriendsScreen />);
  await waitFor(() => expect(view.getByText('Offline')).toBeTruthy());
  (communityRpc as jest.Mock).mockResolvedValue(snapshot);
  await fireEvent.press(view.getByLabelText('Retry'));
  await waitFor(() => expect(view.getByText('Bob')).toBeTruthy());
  expect(view.getByLabelText('Share my activity with friends').props.value).toBe(false);
  await fireEvent.press(view.getByText('Accept'));
  await waitFor(() => expect(communityRpc).toHaveBeenCalledWith('kouponly_respond_friend', { p_id: 'friend-1', p_action: 'accept' }));
});
