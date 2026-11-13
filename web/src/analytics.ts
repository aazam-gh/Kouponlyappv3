const apiKey = import.meta.env.VITE_POSTHOG_KEY;
const host = import.meta.env.VITE_POSTHOG_HOST;
let posthog: typeof import('posthog-js').default | undefined;
let loading: Promise<void> | undefined;

function loadAnalytics() {
  if (!apiKey || !host || typeof window === 'undefined') return;
  loading ??= import('posthog-js').then(({ default: client }) => {
    posthog = client;
    if (!client.__loaded) client.init(apiKey, {
      api_host: host,
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
    });
  });
  return loading;
}

export function identifyAnalyticsUser(userId: string) {
  void loadAnalytics()?.then(() => posthog?.identify(userId));
}

export function resetAnalyticsUser() {
  void loadAnalytics()?.then(() => posthog?.reset());
}

export function capturePageView(pathname: string) {
  void loadAnalytics()?.then(() => posthog?.capture('$pageview', {
    $current_url: `${window.location.origin}${pathname}`,
  }));
}
