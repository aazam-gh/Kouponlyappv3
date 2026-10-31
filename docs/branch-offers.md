# Branch offers and Home controls

In Vendors → Location, add each branch with its own name, address, latitude and longitude. In Offers, use **Valid branches** to restrict each coupon. No checked branches means the coupon applies at every branch, including branches added later. Separate offers retain separate coupon identities and discounts. For example, create a 10% offer assigned only to Branch 1 and a 20% offer assigned only to Branch 2. Edit each offer independently; uncheck **Offer enabled** and save to hide it at its assigned branches without deleting it. Editing a disabled offer keeps it disabled until explicitly enabled.

The app uses the nearest configured coordinates for nearby cards and the default vendor branch. Students can select another branch on the vendor page. The map opens the branch selected on the map. Coupon labels and the redemption confirmation list the applicable branches. Coordinates are not proof that the student is physically at the counter.

Home content → Top Brands selects linked vendors and their display order. New Deals and Trending Offers use large selection controls and priority numbers. Vendors need an active offer to appear in the app. The vendor directory defaults to Latest added and also supports Oldest added and both alphabetical directions.

Release the website route `/vendor/:id` at `kouponly.in` before releasing the mobile share change. Shared HTTPS links show an **Open vendor in Kouponly** button, which uses the installed app’s existing scheme; automatic Universal Links/App Links are not configured by this change.

Apply `20261029120000_branch_offer_validation.sql` with the backend release. It validates branch ownership, coordinate pairs and branch deletion. Existing offers without `branchIds` retain their all-branch scope. Run `supabase/tests/branch_offers.sql` against a migrated Supabase test database to verify normalized offer and location synchronization.

## One coupon per offer per branch

Apply `20261031120000_branch_coupon_slots.sql` before releasing the updated mobile client. A student may consume each eligible `(offer, branch)` once in the current coupon round. Monthly rollover and an awarded referral refresh create a fresh round, restoring every branch's coupons. Branch availability still comes from **Valid branches**; an empty assignment applies to all configured branches.

The redemption RPC validates the branch against the vendor's configured IDs and the offer's assignment, stores the branch ID/name on the receipt, and includes the branch in its retry fingerprint. `usedOfferBranches` drives app availability; older usage fields remain for older clients. Old clients can recover their existing receipts and redeem at vendors with zero/one location, but must update to select a branch at multi-location vendors. Historical receipts with unknown branches remain used at every branch until the next reset. Removing and recreating an offer/branch with a different ID creates a new coupon identity; retain IDs when editing existing locations.

Run the isolated integration suite against an **empty local** database named `benefits_v2` (never a production database):

```sh
KPN_TEST_DATABASE_URL=postgresql://localhost:55439/benefits_v2 python3 supabase/tests/branch_coupon_slots.py --setup
```

The `--setup` flag installs the existing subscription/reset migrations and minimal catalogue fixtures, then the branch-slot migration. Omit it for subsequent test runs. The suite tests three branches, independent offers/students, restricted/disabled offers, duplicate prevention at the database index, concurrent redemptions and retries, changed retry branches, actual referral refreshes and monthly allocation, old receipts, branchless compatibility, BOGO amounts, and anonymous access denial.

## Total offer redemption limit

In **Offers → Create/Edit offer**, set **Total redemption limit** to a positive whole number (for example, 100), or leave it blank for unlimited. This is a shared pool for that offer across all students and valid branches, separate from each student's per-branch allowance. Successful consumed redemptions within `[startsAt, endsAt)` count toward it; without validity dates the limit covers the offer's lifetime. Monthly and referral resets do not replenish this pool. Increasing the limit adds capacity; changing the validity dates recounts redemptions in the new window. Reducing a limit below existing usage immediately exhausts the offer. Deleting development redemption records releases their capacity.

Apply `20261031130000_offer_redemption_limits.sql` before releasing the updated client. Existing offers remain unlimited. The migration backfills usage, refreshes the catalogue compatibility view, and installs atomic server-side enforcement for every redemption entry point. Usage is server-managed and cannot be overwritten by an ordinary offer edit. Exhausted offers remain visible with **Fully redeemed**, and their redemption action is disabled. A stale client is still rejected by the database with `OFFER_EXHAUSTED`; replaying a successful mutation returns its original receipt without consuming capacity again.

After the empty local `benefits_v2` branch-coupon fixture above is prepared, run:

```sh
psql postgresql://localhost:55439/benefits_v2 -v ON_ERROR_STOP=1 -f supabase/migrations/20261031130000_offer_redemption_limits.sql
KPN_TEST_DATABASE_URL=postgresql://localhost:55439/benefits_v2 python3 supabase/tests/offer_redemption_limits.py
```

This tests 105 concurrent requests against a 100-redemption limit, protected usage counters, invalid limits/bills, transaction rollback, idempotency, referrals and monthly rollover, unlimited offers, limit edits, validity recounting, and deletion cleanup. Use a fresh fixture when applying migrations; omit the migration command when rerunning only the tests.

## Allowed student email domains

**Admin → Allowed email domains** (`/admin/school-domains`) controls student access. Enter an exact domain, `@domain`, or `*@domain`. Enable/disable entries to change access without another app release. Matching is case-insensitive, allows no implicit subdomains, and does not accept look-alike suffixes. `20261031140000_enforce_allowed_email_domains.sql` starts with only `rajagiri.edu.in` active and removes the old individual-email exceptions.

The OTP gateway checks the list before sending or accepting student sign-up/login/verification codes. Student enrollment and coupon eligibility are checked in the database; disabling a domain blocks new enrollments and existing accounts' coupon access. The mobile client also checks restored sessions and rechecks on foreground. Existing Auth identities are preserved, and trusted admin roles retain panel access regardless of their email domain. Vendor/admin Auth provisioning remains separate from student enrollment. Apply the migration before deploying the updated gateway and mobile app.

Verification: `supabase/tests/allowed_email_domains.sql` runs rollback-only policy/enrollment/RLS checks against a migrated test database; `deno test --config supabase/functions/deno.json --allow-env supabase/tests/allowed_email_gateway.test.ts` tests the real OTP gateway with network/email delivery mocked.
