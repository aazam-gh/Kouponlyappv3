import React from 'react';
import { AppThemeProvider } from '../context/AppThemeContext';
import { LocaleProvider } from '../context/LocaleContext';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ContactUsScreen from '../app/contact-us';
import { sendContactMessage } from '../lib/contact';

jest.mock('../lib/auth', () => ({ useAuth: () => ({ user: { id: 'student-1', email: 'student@example.edu' } }) }));
jest.mock('../lib/contact', () => ({ sendContactMessage: jest.fn() }));

it('keeps the message after a send failure and confirms a successful retry', async () => {
  (sendContactMessage as jest.Mock).mockRejectedValueOnce(new Error('Try again')).mockResolvedValueOnce({ success: true });
  const view = await render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, bottom: 34, left: 0, right: 0 } }}><AppThemeProvider><LocaleProvider><ContactUsScreen /></LocaleProvider></AppThemeProvider></SafeAreaProvider>);
  expect(view.getByLabelText('Your email address').props.value).toBe('');
  await fireEvent.changeText(view.getByLabelText('Your name'), 'Ada Lovelace');
  await fireEvent.changeText(view.getByLabelText('Your email address'), 'student@example.edu');
  await fireEvent.changeText(view.getByLabelText('Message'), 'I need help with my account.');
  await fireEvent.press(view.getByLabelText('Send message'));
  await waitFor(() => expect(view.getByText('Try again')).toBeTruthy());
  expect(view.getByLabelText('Message').props.value).toBe('I need help with my account.');
  await fireEvent.press(view.getByLabelText('Send message'));
  await waitFor(() => expect(view.getByText('Message sent')).toBeTruthy());
  expect(sendContactMessage).toHaveBeenCalledTimes(2);
  expect(sendContactMessage).toHaveBeenLastCalledWith({ name: 'Ada Lovelace', email: 'student@example.edu', message: 'I need help with my account.' });
});
