'use client';

import posthog from 'posthog-js';

const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (apiKey && host && typeof window !== 'undefined' && !posthog.__loaded) {
  posthog.init(apiKey, {
    api_host: host,
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
  });
}

export function captureAnalytics(event: string, properties?: Record<string, string | number | boolean>) {
  if (apiKey && host) posthog.capture(event, properties);
}
