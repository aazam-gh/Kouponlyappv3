import posthog from 'posthog-js';

const apiKey = import.meta.env.VITE_POSTHOG_KEY;
const host = import.meta.env.VITE_POSTHOG_HOST;

if (apiKey && host && typeof window !== 'undefined' && !posthog.__loaded) {
  posthog.init(apiKey, {
    api_host: host,
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
  });
}

export function identifyAnalyticsUser(userId: string) {
  if (apiKey && host) posthog.identify(userId);
}

export function resetAnalyticsUser() {
  if (apiKey && host) posthog.reset();
}

export function capturePageView(pathname: string) {
  if (apiKey && host) posthog.capture('$pageview', {
    $current_url: `${window.location.origin}${pathname}`,
  });
}
