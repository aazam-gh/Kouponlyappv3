# Free Rajagiri MVP — 2026-10-09

> Email eligibility and offer quotas have since changed. See [invite codes for every verified email](any-email-referrals.md) for the current behavior and deployment verification. The account-domain restrictions below describe the original 2026-10-09 release.

The free MVP replaces the prepaid subscription and manual-voucher model.

- New Supabase Auth accounts and email changes must use the exact @rajagiri.edu.in domain. Email verification is required for coupons, profile completion, and referral claims. Phone verification alone is insufficient. Existing administrator sign-in remains available.
- Eligible accounts automatically receive one coupon per canonical vendor each calendar month. Every offer and branch shares the quota. Monthly boundaries are midnight on the first day in Asia/Kolkata; allocation happens on the next server request, without scheduled resets or deleting data.
- Redemption asks for Yes/Cancel, consumes the coupon only after Yes, and displays a unique server-generated code. The code is optional for the vendor to record and remains visible in history.
- A friend can apply one personal five-character invite code. Only a verified school-email account qualifies. The inviter receives a new coupon round for the current month; unused coupons do not stack and month expiry stays unchanged.
- Referral refreshes are capped at **three total per user**, across all months. This follows the conservative interpretation of “three times at max.”
- Payments, prepaid grants, and manual refresh vouchers are disabled. Old payment routes open free membership.
- The web admin’s **Free MVP membership** page shows the rules, eligible-user count, monthly redemptions, lifetime referral refreshes and the latest 50 coupon receipts. Existing transaction history remains available.

## Implementation

Migration: supabase/migrations/20261009120000_free_rajagiri_mvp.sql. Existing entitlement RPC names, subscription tables, round locks, owner read policies and payload-bound mutation receipts are reused. Historical paid periods and receipts remain intact. Coupons used in old paid periods during the current calendar month also consume the initial free round; a legitimate referral refresh restores availability.

Signup restrictions run in an Auth-table trigger as well as the mobile client and OTP Edge Function, so direct Auth requests cannot bypass them. Existing signup RPCs retain their original profile validation behind a private guarded function. Internal helpers cannot be called by clients. Admin activity is exposed only through a role-checked RPC.

Transport failures retain the redemption’s original operation and round, including if a referral arrives before retry. Recovering an uncertain confirmation replays the original request instead of consuming another coupon.

## Verification and release boundary

The migration was rehearsed against the linked live schema inside a rollback transaction, then applied with its migration-history row in one transaction. The updated kouponly-mobile-action Edge Function was deployed. The rollback-only SQL suite passed again after deployment.

Automated SQL covers domain spoofing, email changes, unverified/phone-only access, free allocation, India calendar boundaries, vendor-wide limits, unique codes, retries, stale rounds, three lifetime refreshes, month reset, history, disabled payments/vouchers, owner reads, and admin isolation. Local concurrency verifies eight redemptions consume once, six referrals grant three rewards, and five retries return one receipt.

Mobile type checks pass. The full Jest suite passed 91 tests across 25 suites; the eight affected suites passed 31 tests and exited normally with open-handle detection. Web development build and TypeScript checks pass. The authenticated web admin page was observed against live Supabase, and the free-membership layout was observed on iOS Simulator. No school inbox OTP, signed-in school-account redemption on a device, physical Android run, app-store release, or hosted web release was exercised. Live test rows were rolled back and zero remaining test accounts were verified. Anonymous benefits/admin calls and outside-domain OTP requests were rejected by the live API.

Qodo’s final review terminated with a server-side failure and supplied no findings; manual review and automated checks were completed.

## In-store admin alignment (2026-10-09)

All existing offers, including Cinepolis, are migrated to in-store redemption. Vendor payload writes normalize embedded offers before catalogue synchronization; the offers table rejects persisted online modes. Admin dashboard, consumed-coupon ledger, vendor analytics and student activity read the same immutable `redemptions` records as mobile. Receipts retain their user, vendor, offer, confirmation code, consumption time, period and round. Historical financial transaction detail URLs and student legacy history remain available. Coupon counts do not imply revenue or savings, which this MVP does not collect.

`supabase/tests/in_store_coupon_admin.sql` rolls back all fixtures and covers free redemption/referrals plus admin isolation, search, pagination and in-store persistence.

## Short vendor receipt codes

New redemptions generate five uppercase characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, using cryptographic randomness. A partial unique index prevents collisions across coupon receipts; only that collision retries generation, with a bounded retry count. Existing receipt codes and idempotent responses remain unchanged. The mobile confirmation button submits directly and disables during the request. The success screen displays the persisted code and consumption timestamp in India time.
