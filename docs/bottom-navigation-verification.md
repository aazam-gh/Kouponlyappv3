# Bottom navigation fix — 2026-10-08

## Cause and fix

Legacy `/realx`, `/realx/map`, and `/realx/profile` routes rendered screens outside the tab navigator. Login completion, closing onboarding, notification links, and several back fallbacks could enter those routes and lose the bottom navigation.

The three routes now redirect to Home, Explore, and Profile inside `(tabs)`. The existing screens were moved unchanged into `mobile/components/screens` and their tab routes updated. iOS tab minimization is set to `never`; the shared JavaScript navigator always displays its bar.

## Checks

- TypeScript: passed.
- Full mobile suite: 88 tests across 24 suites passed. The existing broad suite requires `--forceExit`.
- Four new navigation regression tests passed with `--detectOpenHandles` and exited normally: three legacy redirects and persistent three-tab iOS configuration.
- iPhone 17 Simulator, iOS 26.3: visually verified Home, Explore, and Profile with bottom navigation; selected each tab; opened login and closed it back to Home; opened an offer and returned; terminated and relaunched the app and verified Home navigation again.
- Simulator scroll/drag automation did not produce a measurable scroll, so actual swipe behavior is inconclusive. The `never` minimization configuration is covered by the regression test.
- An existing missing-PostHog-token development warning overlays the bottom area on launch. It was dismissed for visual checks; analytics configuration was not changed.

Screenshots: [Home](verification/bottom-navigation/ios-home.png), [Explore](verification/bottom-navigation/ios-explore.png), [Profile](verification/bottom-navigation/ios-profile.png).

No signed release or physical Android check was performed for this fix.
