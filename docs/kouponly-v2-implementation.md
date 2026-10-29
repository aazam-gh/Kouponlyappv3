# Kouponly V2 feedback implementation

Reference: `Kouponly_V2_CTO_Feedback.docx`, 12 October 2026. Existing working-tree changes were preserved.

| Item | Implementation |
| --- | --- |
| 1 | Home partner banner height increased from 192 to 240 (25%). |
| 2 | Existing five-column category layout retained; larger icons and 15-point labels. |
| 3 | Nearby vendor cards use the lighter theme border. |
| 4 | Outfit regular/semibold/bold hierarchy, consistent shared text defaults, tighter section headings and sentence-case vendor/offer names. |
| 5 | New Deals cards use centered horizontal snap positions. |
| 6 | Smooth rounded SVG curves replace sharp zigzag teeth. |
| 7 | Nearby, New Deals, Trending, Brands and opportunities have See More links to their complete source lists. |
| 8 | Home ends with a three-column Top Vendors logo grid and full-directory link. |
| 9 | Live search on Home and the search screen; matching name prefixes take priority and additional letters narrow the names. |
| 10 | Exact categories and queries without a matching name prefix search categories, subcategory names, admin search tokens, locations, descriptions and offers. |
| 11 | Submit blurs/dismisses the keyboard; search results support tap and drag dismissal; submitted searches do not automatically reopen it. |
| 12 | Pressing the Home tab scrolls its list to the top. Native iOS tabs retain their default scroll-to-top behavior. |
| 13 | Share vendor action shares the registered `kouponly://kouponly/vendor/<id>` app link. Requires Kouponly to be installed. |
| 14 | Instagram link from vendor payload; editable in admin Branding; accepts handles or Instagram URLs. |
| 15 | Website action from the vendor website; editable in admin Branding; links restricted to HTTP(S). |
| 16 | About vendor description shown after promos, information and opening hours. |
| 17 | Larger contained logo beside the vendor name with its own clear frame. |
| 18 | Saved offers entry on vendor pages and Profile. Existing persisted saved-offer screen retained. |
| 19 | Back/share in hero, vendor/contact actions together, labeled Save beside Redeem within each offer. |
| 20 | Coupon limit, remaining availability and membership reset date displayed. Matches existing backend: one coupon per vendor per monthly round; referral rewards refresh the round. |
| 21 | Explicit Referrals / Invite friends menu opens the existing functional invite/share/copy/apply-code and reward flow. |
| 22 | Profile now shows student identity, membership round and the complete account-action menu alongside savings, history and saved offers. |
| 23 | School-domain suggestion prompt in onboarding and Profile; institute, domain and contact email are required; anonymous suggestions are supported without changing signup eligibility. |
| 24 | Student restaurant request: restaurant name required; contact name and phone optional; uses the signed-in email for follow-up. |
| 25 | Invite-code friend requests, recipient acceptance, cancellation/decline/removal, and opt-in activity feed. Sharing is off by default and only accepted friends can see saved offers and redeemed vendors. |

New request submissions are idempotent and validate input on both client and server. The admin Students page includes a review queue. Row-level security protects submissions and sharing preferences. Friendship changes use permission-checked RPCs. Activity exposes names and offers, never email addresses, receipt codes or precise locations.

## Validation and release boundary

- Mobile: 116 tests across 33 suites pass, including live search, URL handling, form retry/draft preservation and friend acceptance UI.
- Mobile and admin TypeScript checks pass. Admin development build passes.
- iOS and web production JavaScript exports pass.
- The migration and `supabase/tests/student_community.sql` pass in an isolated PostgreSQL 14 instance with fixtures matching the referenced table contracts. This verifies SQL execution and privacy/idempotency behavior, not integration with the complete deployed schema.
- Browser phone-width checks cover Home layout, live name narrowing, full-list navigation, vendor actions, and school-form validation.
- Qodo review service failed twice; no completed automated external review.
- Native keyboard, iOS Home-tab reselection, OS share sheet and authenticated friend/referral flows still require device testing. No Simulator was booted during this run.
- On 2026-10-12, both pending migrations (`20261012120000` and `20261012130000`) were applied to the linked Supabase project, and `kouponly-mobile-action` was deployed. Live checks confirmed table permissions, service-only submission RPC access, and the two exact email exceptions. Mobile/admin release deployment remains separate. Instagram buttons appear when vendor metadata is populated.
- Submission requests now use the Edge Function to supply the verified account and hashed gateway IP. The daily quota covers the origin and account, so changing contact email does not reset it; users sharing an IP share the anonymous quota. Private quota history keeps cancelled friend requests counted. Explicit privilege revocation prevents inherited client TRUNCATE privileges. SQL regressions and three endpoint integration tests pass.
