# Subscription and invite verification — 2026-10-08

> Historical verification of the prepaid model. Current rules and verification are in [the free Rajagiri MVP](free-rajagiri-mvp.md).

## Deployment

Applied to linked Supabase project `incgawktquflywvypxiq`:

- `20261009090000_kouponly_subscription_invites`
- `20261009093000_kouponly_referral_lock_order`

Both migrations were tested locally and rehearsed against the deployed schema inside a rollback transaction before application. Each deployment and its migration-history entry committed together. Unrelated pending migrations were not applied.

## Automated checks

- Mobile TypeScript check: passed.
- Mobile Jest suite: **84 tests passed across 23 suites**. The broad suite uses `--forceExit` for existing handles; the six affected/new suites passed **24 tests** with `--detectOpenHandles` and exited normally.
- New provider, screen, redemption and signup tests also run with open-handle detection.
- SQL transactional suite: unique code allocation, verification gating, inviter reward, five-reward cap, seven-day window, shared vendor quotas, preserved history, stale rounds, active expiry, voucher limits, invalid-attempt throttling, payload-bound retries, admin boundaries, RLS, and refund-before-payment ordering.
- Local concurrency suite: eight simultaneous redemptions consume once; two competing voucher claims respect the global allowance; five identical retries return one receipt; terminal referrals avoid cross-account lock deadlocks.
- Live API smoke checks: anonymous benefits/admin/billing calls rejected; non-admin issuance rejected; invite reads isolated to the authenticated account.

## iOS Simulator — iPhone 17, iOS 26.3

Tested using the current local `com.kouponly.app` build against live Supabase, with disposable QA accounts:

- Assigned five-character code visible in Profile.
- Copy feedback and native Share sheet; sharing cancelled without sending.
- Code-entry navigation, keyboard input, invalid-code error and retained draft.
- Voucher rejected for an account without active access.
- Paid coupon confirmation consumes one vendor and displays the server receipt.
- Another verified QA account enters the owner's invite; owner receives a new round and the same expiry.
- Previously consumed coupon becomes available and redeems again.
- Both receipts remain visible in History.
- Voucher restores coupons; retry does not create another round.
- Existing admin role works without creating a student record.
- Admin issues one prepaid month; repeated reference returns the same period.
- Admin creates and copies a voucher; retry returns the same code.
- Payment button visible without scrolling, immediately below the empty-state card.

Evidence: [profile](verification/subscription-invites/ios-invite-profile.png), [payment layout](verification/subscription-invites/ios-payment-methods.png), [redemption](verification/subscription-invites/ios-redemption.png), [referral claim](verification/subscription-invites/ios-referral-success.png), [membership after referral](verification/subscription-invites/ios-membership-after-referral.png), [history](verification/subscription-invites/ios-receipt-history.png), [voucher refresh](verification/subscription-invites/ios-voucher-success.png), [admin voucher](verification/subscription-invites/ios-admin-voucher.png).

## Connected Android — Moto G04

The device was connected initially. Inspected its existing Profile/Subscription screens and discovered that its app was displaying a stale bundle. Reconnected the native debug app to the current Metro server and confirmed the current home screen. The phone subsequently disappeared from ADB before the new invite/redemption flow could be tested. No USB device or wireless debugging service is currently discoverable.

**Physical Android feature validation remains incomplete until the phone is reconnected.** Do not interpret emulator, unit-test, or iOS evidence as proof of Android rendering.

## Payment and release limits

Prepaid membership issuance and entitlement processing are implemented. No automatic charge, saved-card flow, payment provider webhook, store billing, or production signed release was exercised. Provider, price and currency remain unspecified.

No real payment was made. Only disposable QA accounts received test access or redemption receipts. All QA Auth accounts, student profiles, vouchers, and billing events were removed and zero remaining records were verified. Their owned entitlement/claim/receipt rows cascade on account deletion. Reserved invite-code tombstones remain by design. The simulator was signed out of the QA account; the Android account was not changed.

Diff check: changed feature paths are clean. A whole-worktree diff check still reports pre-existing CRLF/trailing whitespace in the unrelated root `package.json`.
