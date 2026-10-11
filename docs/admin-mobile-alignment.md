# Mobile-aligned web admin

The agreed source of truth is the current free Rajagiri student MVP: verified school email, in-store coupons, one redemption per vendor per round, India calendar months, and three lifetime referral refreshes. Both workflow and styling follow mobile.

## Decisions

- Navigation: Overview, Home content, Explore & vendors, Students & profiles, Coupons & referrals, Notifications.
- Events, Trending Offer Banners, and Universities are hidden from MVP navigation. Their routes and data remain available.
- Manual student/creator creation and document-verification UI are removed. Old verification links redirect to Students.
- Existing vendor editors, in-store offer management, branch management, notifications and immutable coupon receipts remain.

## Home content map

| Mobile section, in screen order | Admin control | Source |
| --- | --- | --- |
| Partner carousel | Partner banners | `couponly_cms_documents`, `banner` |
| Categories | Categories & subcategories | Normalized category and subcategory rows |
| Nearby vendors | Vendor branches, coordinates, cover image | Vendor/location rows and nearby RPC |
| New deals | Active offers; vendor New deals priority | Current catalogue ordered by `newest` |
| Featured carousel | Featured showcase | `couponly_cms_documents`, `featuredBrandShowcase` |
| Trending offers | Vendor Trending toggle | Catalogue `trend` priority |
| Brand grid | Brand logos | `couponly_cms_documents`, `brand` |

The mobile screen also imports opportunity highlights. Those depend on published legacy opportunities rather than a new MVP workflow; this revamp does not republish legacy campaigns or add a new editor.

## Corrected differences

- The admin Trending toggle previously read/wrote `featured` while mobile sorted by `trend`. It now reads the mobile priority; vendor writes keep both values consistent, preserve an existing positive priority, and clear the priority when the toggle is off.
- Student screens now read Auth email-confirmation status and `profiles`, rather than inferring eligibility from a school email or manual document approval.
- Saved vendors and offers now come from `saved_deals` and `saved_offers`, matching mobile. Old `couponly_student_saved_items` data is retained.
- Personal invites use `kouponly_invite_codes`; successful lifetime refreshes use `kouponly_reward_grants`. Legacy creator codes and financial totals are no longer presented as current MVP benefits.
- Current-round usage includes qualifying historical paid-period receipts, matching the mobile benefits read. Admin reads never allocate periods, qualify referrals or reset coupons.
- Vendor coupon analytics no longer depends on obsolete transaction/revenue queries before rendering.
- Offer date inputs display local wall time and save UTC, avoiding the previous UTC-to-local shift. Input labels state the timezone convention.
- Vendor editors expose active/inactive visibility, new-deal priority and catalogue order, with whole-number validation.
- Coupons & referrals links to the full consumed-coupon ledger instead of duplicating a limited latest-50 receipt table.

## Visual direction

Reuse Outfit and existing UI components. Mobile light colors: white `#FFFFFF`, ink `#0A0F0C`, green `#18B852`, muted surface `#F1F4EF`, secondary text `#5F6861`, border `#E2E8E1`. Use a light sidebar, rounded navigation, quiet dividers and responsive tables. Home content uses a single ordered list so its relationship to the mobile screen is visible.

## Backend and checks

`20261009150000_mobile_aligned_admin_students.sql` adds an admin-only, read-only RPC with bounded pagination and literal name/email/invite search. Anonymous execution is revoked; authenticated non-admin calls fail. It does not broaden table RLS or delete any data.

Checks: web TypeScript/build, the existing admin vendor bridge test, rollback-only `supabase/tests/mobile_aligned_admin_students.sql`, and authenticated browser inspection. The SQL suite covers authorization, mobile profiles without legacy student rows, actual email eligibility, pagination, wildcard search, saved items, referral state and absence of allocation during admin reads.

Verified on 2026-10-09: the new migration and its history entry were applied atomically to the linked project; the SQL suite passed before and after application, anonymous execute is disabled, and zero test accounts remain. Authenticated browser checks covered Home content, students, a student profile, vendor catalogue/editor/analytics, coupons and the old verification-route redirect. Home content also rendered at 390px without page overflow. Offer date round-trips passed in UTC, Qatar and India; the vendor bridge and web development build/type checks passed. Qodo's final review failed on its server and returned no findings; manual review was completed.

This change does not publish a hosted web build or a mobile release. Production notification sends and vendor-record writes require separate runtime evidence.
