# Kouponly Supabase setup

The mobile app is local-first. Guests use an isolated bundled catalogue and AsyncStorage profile. Signed-in users load cloud state into a separate per-user cache, receive Realtime changes, and queue safe row-level writes while offline. Redemptions, rewards, gifts, campaign applications, uploads, and account deletion use the hosted backend. Authenticated mobile operations call protected database RPCs and RLS-scoped tables directly. Account deletion still requires the `delete-account` Edge Function because it uses the server-only Supabase Admin API.

The currently configured Supabase project is `incgawktquflywvypxiq` (`https://incgawktquflywvypxiq.supabase.co`). Its mobile schema, seeded catalogue, secure mobile hardening, and authenticated API grants have been applied. All seven catalogue REST endpoints have been verified. The `delete-account` Edge Function is deployed with JWT verification and performs owner storage cleanup before deleting the Auth user.

## Hosted deployment

Authenticate the CLI, link the existing project, then apply the database and functions:

```sh
npx supabase login
npx supabase link --project-ref incgawktquflywvypxiq
npx supabase db push --linked
npx supabase functions deploy delete-account --project-ref incgawktquflywvypxiq
```

The hosted Auth redirect allowlist includes the app callback `kouponly://auth`. If you use Expo Go rather than the configured native app scheme, add the exact Expo Go redirect URL for that development session. Email/password sign-up, confirmation, recovery, password/email updates, refresh, and deletion are implemented. Configure production SMTP before enabling mandatory confirmation. The Supabase CLI migration history was seeded from the SQL Editor bootstrap; after authenticating the CLI, run `npx supabase migration list --project-ref incgawktquflywvypxiq` before future `db push` operations.

Private `avatars` and `campaign-media` buckets, their owner-folder policies, catalogue seed records, and Realtime publication are created by migrations. The repository includes a new atomic `complete-redemption` function; the mobile client currently calls the matching authenticated RPC directly. Mobile reads the normalized vendor taxonomy, offers, and locations directly; bundled catalogue seeds are no longer generated. Refresh mobile types from the linked cloud schema with `npx supabase gen types typescript --linked`.

## Optional local backend verification

A Docker-compatible runtime is required only for the optional local Supabase stack. The mobile app and deployed cloud project do not use Docker at runtime.

```sh
npm run supabase:start
npm run supabase:reset
npm run supabase:test
npm run supabase:types
```

The publishable key is safe for the mobile client because every user-owned table has Row Level Security. Never place a Supabase secret key in `mobile/.env.local` or any Expo public variable.
