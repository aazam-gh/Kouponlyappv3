# Kouponly admin dashboard

This is Kouponly's web administration dashboard. It lives alongside the Kouponly mobile app and uses Supabase Auth, Postgres, Storage, and the `kouponly-admin-action` Edge Function.

## Run locally

1. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`) for the Supabase project.
2. Install and start the dashboard:

   ```sh
   pnpm install
   pnpm dev
   ```

   Vite serves it on `http://localhost:3001`.

## Connect a Supabase project

1. Apply every SQL file in `../supabase/migrations/` in timestamp order to the Supabase project configured in `web/.env.local`. Confirm the canonical tables are present before continuing:

   ```sql
   select to_regclass('public.couponly_user_roles');
   ```

   The result should be `public.couponly_user_roles`. If it is `NULL`, the migrations have not completed.
2. Deploy `kouponly-admin-action`, `kouponly-mobile-action`, `kouponly-maintenance`, and `kouponly-delete-account` from `../supabase/functions/`.
3. Configure Edge Function secrets `OTP_HMAC_SECRET`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`.
4. Create the first admin in Supabase Auth, then add that user's role from the SQL editor:

   ```sql
   insert into public.couponly_user_roles (user_id, role)
   select id, 'admin'
   from auth.users
   where lower(email) = lower('info@kouponly.in')
   on conflict (user_id) do update set role = excluded.role;
   ```

5. Use the same Supabase project URL and public key in `mobile/.env.local` as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

6. To run the scheduled cleanup and Expo receipt reconciliation, enable `pg_cron`, `pg_net`, and Vault in the Supabase project, then add Vault secrets named `couponly_project_url` and `couponly_service_role_key`. The migration schedules daily cleanup at 23:00 UTC and receipt checks every 15 minutes when those extensions and Vault are available. Otherwise, call `kouponly-maintenance` from a trusted scheduler with `dailyMaintenance` or `processNotificationReceipts` and a service-role bearer token.

The admin dashboard uses Supabase Auth, Postgres, Storage, and Edge Functions directly. Only public Supabase keys belong in either app. The service role key belongs in Edge Function secrets and Vault; never put it in a Vite or Expo environment file.

Use a Supabase CLI version compatible with `supabase/config.toml`. Verify the linked project before running `supabase db push`; a dry run shows pending migrations.

Run `npm run check`, `npm run build`, `node scripts/check-vendor-writes.cjs`, `node scripts/check-image-lifecycle.cjs` to verify admin changes.
