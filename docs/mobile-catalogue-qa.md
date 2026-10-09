# Mobile / admin / Supabase catalogue verification

Verified on 5 October 2026 against `incgawktquflywvypxiq.supabase.co`, the existing signed-in admin on port 3001, and the running Kouponly iOS development app on the booted iOS 26.3 simulator. Existing login sessions were preserved.

## Findings and fixes

| Finding | Correction |
| --- | --- |
| Admin failed to open vendor settings with a missing relationship in the REST schema cache. | Refreshed the Supabase API schema cache and added a migration notification for the taxonomy relationships. Verified the exact admin embedding request returns HTTP 200. |
| Mobile ignored uploaded branding covers. | Shared vendor projection now uses `cover_image_url` for photos, with existing vendor media as fallback. |
| Admin stores offer logos in `couponly_offers.image_url`, but mobile used a vendor photo or an older payload logo for the logo slot. | Cards use the current primary offer logo; detail selection and offer directory rows use each offer's own logo. The nearby SQL feed now returns the vendor cover as its card photo. |
| Short description and Trending Vendor edits lost to older duplicated fields. | Admin reads canonical description/logo/featured values and writes the fields actually edited by Branding Settings. Empty descriptions can be cleared. |
| Replacing an upload at the same Storage path could reuse cached images. | Newly returned upload URLs include a version query parameter. Existing storage paths and contracts remain compatible. |
| Map opened a separate older vendor page using embedded offers. | Map preview and callout open the same normalized deal detail used by Home and Search. |
| Search results appeared beneath a large blank area. | Horizontal rails no longer expand to fill the vertical screen. Search results remain reachable. Missing category pictures are shown as neutral backgrounds, without empty-URI warnings. |
| Vendor gallery and offer redemption instructions were fetched but omitted from details. | Details now display uploaded gallery photos and the selected offer's terms and redemption instructions. |
| Saving an offer could discard an existing offer ID. | Admin preserves the ID when editing an existing offer. |

## Live API checks

The read-only `node mobile/scripts/check-catalogue.cjs` script uses the mobile public configuration and actual shared projector. It checks admin relationship embedding, canonical names/categories, all available offer titles/descriptions/logos/saving labels/terms/instructions, assigned subcategory IDs, branches, gallery arrays, nearby-feed parity, and uploaded image accessibility.

| Record or check | Result |
| --- | ---: |
| Active vendors / projected mobile vendors | 16 / 16 |
| Current offers | 16 |
| Linked branches | 16 |
| Active main categories | 7 |
| Defined subcategories | 33 |
| Assigned vendor subcategories | 0 |
| Category images | 0 |
| Gallery images | 0 |
| Nearby food offers returned | 6 |
| Uploaded covers and offer logos checked | 32, all HTTP 200 and image MIME types |
| Admin embedding and mobile field parity | Passed |

Zero subcategory assignments and missing category pictures are actual database contents. The Food/Rice filter correctly has no matches until vendors are assigned Rice in the admin. Vendor branding covers and category pictures are separate fields.

## Runtime walkthrough

- Home: uploaded restaurant cover and corresponding offer logo appear in the correct slots; nearby offers return location-derived distances.
- Food category: 12 vendor and offer directory entries for the six Food vendors. Rice returns an honest empty state because assignments are empty.
- Search: submitting Biryani returns Paragon with the correct title, saving label, place, and cover. Opening the result reaches the shared detail.
- Detail: Paragon and Burger King show their own covers, offer logos, descriptions, saving labels, and current account usage states. Scrolling reveals the stored branch address and directions control.
- Map: fetched branch locations and displayed four vendors in the current viewport. Opening Burger King reaches the normalized deal detail with its correct offer.
- Saved: save/remove toggled successfully and restored the original state; the empty saved list then displayed without seeded content.
- Account: the existing signed-in session remained intact.
- Admin: branding, offers, offer editor, cover and logo previews loaded. Saved the existing Paragon offer without editing its values; the editor returned to the offer list and live API parity remained valid.

## Automated verification

- Mobile Jest: **48 tests passed across 9 suites**, including multiple offers, selected offer logo, terms/instructions, branches, strict taxonomy filtering, expired/future/inactive offers, asynchronous catalogue loading, error/retry, and empty Supabase responses without sample fallback.
- Admin bridge check: `node web/scripts/check-vendor-bridge.cjs` passed using the actual read/edit/write bridge with a mocked database, checking canonical branding, clearing fields, featured state, taxonomy, and preserving offers.
- Live SQL test: `supabase db query --linked --file supabase/tests/uniform_vendor_taxonomy.sql --output json` passed; test records and taxonomy edits were rolled back. Covers multiple assignments, category switching, rename identity, compound foreign keys, required main category, public reads, denied public writes, and fabricated redemption index rejection.
- Mobile TypeScript check passed.
- Admin development build and TypeScript check passed.
- iOS JavaScript export passed.
- `git diff --check` passed.

Database migrations `20261005202000_refresh_vendor_taxonomy_api.sql` and `20261005203000_nearby_vendor_cover_image.sql` were applied to the linked project.

## Evidence and limits

Screenshots are saved in the current task's visualization directory as `catalogue-home.jpg`, `catalogue-detail.jpg`, and `catalogue-search.jpg`.

This verifies the local mobile development app, local admin source, and live Supabase API. No Android device/emulator was connected; Android runtime is unverified. No new store build or OTA update was released. Actual financial redemption was not performed; database validation was checked with rollback-only tests. Gallery display, multiple offers, offer schedules, and assigned subcategories are covered by automated cases because current live records have one current offer each, no gallery photos, and no subcategory assignments. Newly uploading/replacing files was not exercised during the walkthrough; existing uploaded assets were checked live.

The general catalogue displays vendor distance/rating fields as stored in Supabase; the nearby feed computes distance from the device position and branch coordinates. Those stored vendor fields were not independently verified as business facts.
