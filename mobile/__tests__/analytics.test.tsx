jest.mock('posthog-react-native', () => ({ PostHogProvider: () => null }));
import { AnalyticsProvider } from '../lib/analytics';

it('disables analytics network traffic in development', () => {
  expect(AnalyticsProvider({ children: null }).props.options.disabled).toBe(true);
});
