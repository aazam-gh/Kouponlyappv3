# Kouponly on Supabase

The Kouponly Expo app exposes a Kouponly student area under `mobile/app/kouponly/`. It covers account setup and profile, school verification, campus offers and partner details, categories and search, location listings, saved items, in-store redemption, wallet/history, and opportunities. The Kouponly administration app is a separate Vite project in `web/`; its routes use a Supabase-backed Firestore compatibility layer to preserve the source panel's screens and request shapes.

## Backend mapping

The original schema migration added student/creator accounts and roles, universities, categories, vendors, offers, saved items, transactions, reward balances, email/ID verification, CMS documents, opportunities and qualified actions, map locations/cache, push tokens and notification delivery records, OTP challenges, rate limits, and audit history. The September 30 cleanup migrations remove the unused Holding Groups, Wakti, Badrgo, and Online Vendors tables and functions while retaining regular vendor records, admin/vendor roles, and transaction history.

Postgres functions provide transactional signup/code assignment, verification decisions, PIN protected redemption, opportunity qualification, rate limiting, and map-cache updates. `realx-mobile-action` replaces mobile callable requests. `realx-admin-action` provides the admin callable operations. Database triggers rebuild vendor map rows and embedded offers whenever vendor data changes. `realx-maintenance` expires transient/verification records and reconciles Expo delivery receipts.

## Current connection state

The cleanup migrations were applied to the connected Supabase project. The local web admin panel was rebuilt and the updated navigation was visually verified.

Firebase data is not copied by applying the schema. Existing Firebase students, vendors, claims, content, files, and transaction history need an explicit export/import with Firebase Auth user IDs mapped to Supabase Auth UUIDs.
