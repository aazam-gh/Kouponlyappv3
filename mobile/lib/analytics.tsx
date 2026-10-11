import React from 'react';
import { PostHogProvider } from 'posthog-react-native';

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST;

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  return <PostHogProvider
    apiKey={apiKey}
    options={{ host, disabled: __DEV__ || !apiKey || !host, enableSessionReplay: false, disableGeoip: true, disableRemoteFeatureFlags: true }}
    autocapture={{ captureScreens: false, captureTouches: false }}
  >{children}</PostHogProvider>;
}
