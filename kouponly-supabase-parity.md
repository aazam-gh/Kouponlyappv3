# Kouponly on Supabase

The Kouponly Expo app exposes a student area under `mobile/app/kouponly/`. It covers account setup and profile, school verification, campus offers and partner details, categories and search, location listings, saved items, in-store redemption, wallet/history, and opportunities. The administration app is a separate Vite project in `web/`; it uses Supabase Auth, Postgres, Storage, and Edge Functions directly.

## Backend mapping

The Supabase schema includes student/creator accounts and roles, universities, categories, vendors, offers, saved items, transactions, reward balances, email/ID verification, CMS documents, opportunities and qualified actions, map locations/cache, push tokens and notification delivery records, OTP challenges, rate limits, and audit history.

Postgres functions provide transactional signup/code assignment, verification decisions, PIN protected redemption, opportunity qualification, rate limiting, and map-cache updates. `kouponly-mobile-action` and `kouponly-admin-action` provide privileged operations. Database triggers rebuild vendor map rows and embedded offers whenever vendor data changes. `kouponly-maintenance` expires transient/verification records and reconciles Expo delivery receipts.

## Current connection state

The web admin dashboard reads and writes Supabase directly. The schema and Edge Functions are maintained under `supabase/`; no Firestore compatibility layer is used by the dashboard.
