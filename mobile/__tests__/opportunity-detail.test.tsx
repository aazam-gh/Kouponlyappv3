import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RealXOpportunityDetailScreen from '../app/realx/opportunity/[id]';

const mockMaybeSingle = jest.fn();
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) }) }) }) }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() }, useLocalSearchParams: () => ({ id: 'opportunity-1' }) }));
jest.mock('../lib/auth', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../context/AppThemeContext', () => ({ useAppTheme: () => ({ theme: { background: '#fff', surfaceElevated: '#fff', brand: '#18b852', brandSoft: '#e5f7eb', brandText: '#128a43', text: '#0a0f0c', mutedText: '#5f6861', subtleText: '#7b847d', border: '#e2e8e1', actionSolid: '#0e7a38', onActionSolid: '#fff' } }) }));
jest.mock('../context/LocaleContext', () => ({ useAppLocale: () => ({ locale: 'en', isRTL: false }) }));

afterEach(() => { cleanup(); jest.clearAllMocks(); });

it('renders the populated Supabase opportunity detail without backend writes', async () => {
  mockMaybeSingle.mockResolvedValue({ data: { id: 'opportunity-1', title: 'Graduate Product Fellowship', starts_at: '2026-11-01T00:00:00Z', ends_at: '2026-11-30T00:00:00Z', published: true, payload: { kind: 'internship', providerName: 'Qatar Innovation Lab', location: 'Doha, Qatar', imageUrl: 'https://example.com/fellowship.jpg', descriptionEn: 'Work with a local product team on a twelve-week fellowship.' } }, error: null });
  const frame = { x: 0, y: 0, width: 393, height: 852 };
  render(<SafeAreaProvider initialMetrics={{ frame, insets: { top: 59, left: 0, right: 0, bottom: 34 } }}><RealXOpportunityDetailScreen /></SafeAreaProvider>);
  await waitFor(() => expect(screen.getByText('Graduate Product Fellowship')).toBeTruthy());
  expect(screen.getByText('Qatar Innovation Lab')).toBeTruthy();
  expect(screen.getByText('Doha, Qatar')).toBeTruthy();
  expect(screen.getByText('Work with a local product team on a twelve-week fellowship.')).toBeTruthy();
  expect(screen.getByText('View opportunity')).toBeTruthy();
  expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
});
