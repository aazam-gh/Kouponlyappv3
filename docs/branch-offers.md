# Branch offers and Home controls

In Vendors → Location, add each branch with its own name, address, latitude and longitude. In Offers, use **Valid branches** to restrict each coupon. No checked branches means the coupon applies at every branch, including branches added later. Separate offers retain separate coupon identities and discounts.

The app uses the nearest configured coordinates for nearby cards and the default vendor branch. Students can select another branch on the vendor page. The map opens the branch selected on the map. Coupon labels and the redemption confirmation list the applicable branches. Coordinates are not proof that the student is physically at the counter.

Home content → Top Brands selects linked vendors and their display order. New Deals and Trending Offers use large selection controls and priority numbers. Vendors need an active offer to appear in the app. The vendor directory defaults to Latest added and also supports Oldest added and both alphabetical directions.

Release the website route `/vendor/:id` at `kouponly.in` before releasing the mobile share change. Shared HTTPS links show an **Open vendor in Kouponly** button, which uses the installed app’s existing scheme; automatic Universal Links/App Links are not configured by this change.

Apply `20261029120000_branch_offer_validation.sql` with the backend release. It validates branch ownership, coordinate pairs and branch deletion. Existing offers without `branchIds` retain their all-branch scope. Run `supabase/tests/branch_offers.sql` against a migrated Supabase test database to verify normalized offer and location synchronization.
