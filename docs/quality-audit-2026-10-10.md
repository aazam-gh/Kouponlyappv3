# Kouponly quality audit — 10 October 2026

This audit covers the Expo mobile app, Vite admin panel and Supabase backend. It does not certify “100% optimization”: no workload, latency, memory or throughput target was specified, and functional tests do not prove absence of all bugs or leaks.

## Changes

- Mobile auth and profile lookups ignore outdated account responses. Admin role lookups cannot restore previous-account privileges after sign-out, and account changes clear the admin query cache.
- Offline bookmark/interests sync runs one writer per account, preserves actions added during synchronization, stops on failed earlier operations to retain order, and keeps unsynced local state. Account hydration cannot write the previous account's cache under another account's key.
- Profile loading tolerates damaged local JSON and unavailable avatar URLs. Successful pending synchronization uses server edit flags. Permanent server validation failures are not retained as offline edits. Avatar uploads cancel on provider cleanup and recheck account ownership before updating the profile.
- Fixed the unreachable onboarding `profile` state: incomplete sign-in accounts return to the signup form to enter their names.
- Catalogue Realtime subscriptions target published `couponly_*` tables, while REST reads retain the `realx_*` compatibility views.
- Admin subscriptions ignore stale responses and callbacks after unsubscribe. Image compression releases object URLs on success and failure; bitmap conversion always closes decoded images. Existing public-media URLs use public downloads for both bucket aliases.
- Removed unused prototype code generation and state-merging helpers, and over 700 lines of duplicate legacy Edge Function implementations. Legacy entry files import the canonical handlers.
- Added 34 foreign-key indexes and removed direct REST execution privileges from two trigger-only functions. Existing client RPC permissions remain available.
- Test query caches use infinite garbage-collection time, preventing cache timers from keeping Jest alive. Production cache timing is unchanged.
- Admin router developer tools render only in development. The native development warning overlay ignores the exact expected Reanimated notice caused by applying the app's reduced-motion preference.
- Analytics is disabled in development; a PostHog network failure otherwise opened an error overlay that intercepted simulator tab taps. Production analytics configuration is preserved.
- Updated mobile/admin setup documentation to describe the actual Supabase architecture and canonical function names.

## Verification

| Check | Result |
| --- | --- |
| Mobile Jest baseline | 96 tests passed, but process did not exit |
| Mobile final Jest | 109 tests across 31 suites passed; normal process exit |
| Mobile TypeScript | Passed |
| Admin TypeScript and production build | Passed |
| Admin vendor bridge assertions | Passed |
| Image compression lifecycle assertions | Passed for success, decoding failure, unavailable canvas and failed encoding |
| Realtime subscription lifecycle assertions | Passed for out-of-order responses and unsubscribed callbacks |
| Canonical and alias Edge Function type checks | Passed; deprecated redemption endpoints checked with their own import maps |
| Live rollback SQL tests | English-only schema, free MVP, vendor taxonomy, admin students, coupon admin, backend hardening and one-time profile edits passed |
| Isolated concurrency test | Eight simultaneous redemptions consume once; six referral claims grant three refreshes; five retries return one receipt |
| Migration dry run after deployment | Remote database up to date |
| Git whitespace check | Passed |

The one-time profile SQL test uses disposable users inside a rollback transaction. It verifies first-edit flags, rejection of a second edit, denial of direct protected-column updates, rejection of another account's avatar path, and malformed payload rejection. Live SQL tests leave their fixtures rolled back.

The iOS simulator was cold-launched from the current Metro source. Home content, profile details, populated profile editor, redemption history, vendor details and expandable offer information were observed. After removing the development analytics blocker, the Profile tab opened normally. The original profile-load alert did not recur. Real coupon confirmation, one-time profile edits and account deletion were not performed through the UI.

The existing authenticated Chrome admin session was tested against the local admin source and linked backend: student list and profile details, vendor pagination and empty search results, home-content navigation, coupon/referral overview, notifications composition/history and dashboard loading. No notifications or catalogue changes were submitted.

## Deployment and remaining limits

Migration `20261010140000_index_foreign_keys_and_guard_triggers.sql` was applied to linked project `incgawktquflywvypxiq`. The updated canonical `kouponly-admin-action` and `kouponly-maintenance` functions were deployed. Legacy alias refactors remain source compatibility entrypoints; no new public endpoints were created. Mobile and admin frontend changes are local and have not been published as app releases or to Cloudflare Pages.

The live advisor report now contains zero missing foreign-key index findings. It still lists 35 unused indexes, 14 multiple-policy warnings, five anonymous and 28 authenticated security-definer RPC warnings, one public-extension warning, one leaked-password-protection warning and six RLS tables without client policies. Newly created or low-traffic indexes are not removed merely because usage statistics are empty. Client-facing security-definer RPCs and default-deny service tables are deliberate contracts; their presence is not proof of a vulnerability. The remaining warnings require individual interpretation, not blanket permission revocation or policy removal.

The main admin bundle remains approximately 665 kB minified. This audit does not claim a smaller bundle or measured production latency/memory improvements. The foreign-key indexes address missing lookup coverage; representative production-load benchmarks remain unperformed.

Direct database lint failed because Supabase's temporary database role could not authenticate. Management API SQL tests and advisors worked. Both Qodo review attempts failed without findings; the final response reported exhausted organization credits. No independent Qodo approval was obtained.

No Android device/emulator was connected, and Maestro was unavailable. Android runtime, push delivery, real uploads, destructive account deletion, production frontend behavior and sustained-load memory profiling remain untested.

Evidence logs for this run are in `/tmp/kouponly-quality-audit/`; they are temporary local artifacts. The isolated PostgreSQL server and audit-created hanging test processes were stopped. Existing Metro, Vite, browser sessions and unrelated worktree edits were preserved.
