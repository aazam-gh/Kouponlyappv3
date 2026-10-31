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
