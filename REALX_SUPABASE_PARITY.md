# RealX on Supabase

The Kouponly Expo app exposes a RealX student area under `mobile/app/realx/`. It covers account setup and profile, school verification, campus offers and partner details, categories and search, location listings, saved items, in-store redemption, wallet/history, opportunities, Wakti checks, online offers, and Badrgo vouchers. The RealX administration app is a separate Vite project in `web/`; its existing admin routes use a Supabase-backed Firestore compatibility layer to preserve the source panel's screens and request shapes.

## Backend mapping

The migration creates a namespaced RealX schema beside Kouponly's existing tables. It includes student/creator accounts and roles, universities, categories, vendors, embedded and normalized offers, saved items, transactions, reward balances, email/ID verification, Wakti checks, CMS documents and collections, online offer configuration/click tracking, opportunities and qualified actions, map locations/cache, holding groups/memberships, push tokens and notification delivery records, both Badrgo pilot campaigns and voucher inventory/claims, OTP challenges, rate limits, and audit history. Foreign keys preserve user, vendor, offer, holding-group, campaign, opportunity, and voucher relationships.

Postgres functions provide transactional signup/code assignment, verification decisions, PIN protected redemption, online click recording, opportunity qualification, Qatar-week Badrgo voucher claims, Badrgo pilot inventory/identity locks, redemption imports, rate limiting, and map-cache updates. `realx-mobile-action` replaces mobile callable requests. `realx-admin-action` provides the admin callable operations and holding/dashboard queries. Database triggers rebuild vendor map rows and embedded offers whenever vendor data changes. `realx-maintenance` expires transient/verification records and reconciles Expo delivery receipts.

## Current connection state

This work adds the local migration and function source. The hosted Supabase project has not been migrated or had these functions deployed; a read-only API check during this work returned a missing-table response for `realx_students`. The app and panel therefore cannot use the RealX schema on that hosted project yet. Follow `web/README.md` to apply the migration and deploy the Edge Functions.

Firebase data is not copied by applying the schema. Existing Firebase students, vendors, claims, content, files, and transaction history need an explicit export/import with Firebase Auth user IDs mapped to Supabase Auth UUIDs. The Badrgo pilot-to-voucher action works after the legacy campaign rows and code/claim inventory have been imported into the corresponding `realx_pilot_*` tables.
