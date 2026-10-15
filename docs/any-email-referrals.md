# Invite codes for every verified email — 2026-10-14

Personal invite codes and free monthly coupons now work for any verified email domain. A verified invitee applies one friend's code; the inviter receives a fresh coupon round, resetting consumed offer slots for the current month. The invitee receives normal monthly access. Month expiry and all redemption receipts remain intact. Unused coupons do not accumulate.

The existing three lifetime referral refreshes, one inviter per account, self-referral rejection, request rate limits, owner access policies, ordered account locks, and payload-bound retries remain in place. Anonymous, unverified, and phone-only accounts do not qualify. Separate school/ID-review flows retain their school-specific rules.

## Implementation and deployment

`supabase/migrations/20261014120000_any_email_referral_benefits.sql` replaces the domain checks in free-month allocation, referral qualification, code claims, benefits, signup aliases, and admin eligibility. A private verified-email helper keeps those decisions consistent. The free plan is named **Free Kouponly membership**. Existing table names, RPC names, data, and coupon history remain compatible.

The migration was rehearsed against the live schema within rollback transactions, then deployed with the Kouponly-scoped CLI to project `incgawktquflywvypxiq`. The deployment preview contained only this migration. The existing OTP Edge Function already accepts any valid email for signup and login; this change requires no Edge Function update.

The app now explains general email eligibility in the invite card, native share message, redemption screen, and benefits errors. Signup applies general-email invites normally and surfaces claim failures. Email changes use Supabase's existing validation and confirmation flow. Admin labels and eligibility descriptions match the backend.

## Verified

- All **157 mobile tests across 38 suites** passed, including general-email signup claims, sharing, owner-scoped benefits, eligibility withdrawal, email changes, retry handling, and coupon redemption.
- Mobile TypeScript, web TypeScript, and the production web build passed. The existing web bundle-size warning remains.
- The following rollback-only SQL suites passed before and after deployment: `any_email_referrals.sql`, `free_rajagiri_mvp.sql`, `in_store_coupon_admin.sql`, and `mobile_aligned_admin_students.sql`. They cover Gmail/Outlook/general-domain and Rajagiri eligibility, real verification triggers, unverified/anonymous/phone-only rejection, free allocation, offer redemption, exact retries, stale rounds, preserved receipts/expiry, monthly resets, lifetime caps, rate limits, and admin/owner isolation.
- An isolated local database concurrency test passed: eight redemptions consume exactly once, six simultaneous friends grant exactly three refreshes, and five concurrent retries return one receipt.
- Authenticated calls against the deployed HTTPS API passed with temporary Gmail and Outlook accounts: signup profile completion, benefits, real-offer redemption, duplicate rejection, exact receipt replay, referral refresh, restored offer slots, stale-round rejection, repeat redemption, retained history/expiry, no duplicate referral reward, and admin access denial. Test accounts were deleted; their codes remain reserved under the existing deleted-account registry policy.
- On the running iOS Simulator, the invite screen displayed any-email copy and the live assigned code/count, Copy displayed success, the native share sheet opened, lowercase input normalized to uppercase, and self-referral returned the expected server error. No invitation was sent and no existing user's coupon was consumed.

Repeat the SQL checks using the scoped command, for example:

```sh
/Users/alcadeus/.local/bin/supabase-account run kouponly db query --linked --file supabase/tests/any_email_referrals.sql --output json
```

## Release boundaries

Real inbox OTP delivery, physical-device testing, app-store/OTA publication, and hosted admin publication were not performed. The backend change is live; updated app/admin wording requires distributing the corresponding frontend source. Old backend responses remain understood by the mobile benefits provider.
