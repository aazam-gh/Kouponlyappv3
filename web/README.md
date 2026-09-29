# RealX admin panel

This is the standalone RealX administration app. It lives beside the Kouponly mobile app and uses Supabase Auth, Postgres, Storage, and the `realx-admin-action` Edge Function.

## Run locally

1. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`) for the Supabase project.
2. Install and start the panel:

   ```sh
   pnpm install
   pnpm dev
   ```

   Vite serves it on `http://localhost:3001`.

## Connect a Supabase project

1. Apply `../supabase/migrations/20260929100000_realx_feature_parity.sql` to the target project.
2. Deploy `realx-admin-action`, `realx-mobile-action`, and `realx-maintenance` from `../supabase/functions/`.
3. Configure Edge Function secrets `OTP_HMAC_SECRET`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`. `WAKTI_API_KEY` is optional and is only needed for Wakti requests made by a trusted external service.
4. Create the first admin in Supabase Auth, then add that user's role from the SQL editor:

   ```sql
   insert into public.realx_user_roles (user_id, role)
   select id, 'admin'
   from auth.users
   where lower(email) = lower('admin@example.com')
   on conflict (user_id) do update set role = excluded.role;
   ```

5. Use the same Supabase project URL and public key in `mobile/.env.local` as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

6. To run the scheduled cleanup and Expo receipt reconciliation, enable `pg_cron`, `pg_net`, and Vault in the Supabase project, then add Vault secrets named `realx_project_url` and `realx_service_role_key`. The migration schedules daily cleanup at 23:00 UTC and receipt checks every 15 minutes when those extensions and Vault are available. Otherwise, call `realx-maintenance` from a trusted scheduler with `dailyMaintenance` or `processNotificationReceipts` and a service-role bearer token.

Only public Supabase keys belong in either app. The service role key belongs in Edge Function secrets and Vault; never put it in a Vite or Expo environment file.

The installed Supabase CLI in this workspace is older than some fields in the existing `supabase/config.toml`; its local status command currently rejects those fields. Use the SQL editor for the migration or update the CLI/config pairing before using local Supabase commands. The hosted project has not been migrated and the Edge Functions have not been deployed by this change. Firebase records are not imported automatically; map legacy Auth users to Supabase UUIDs before importing foreign-keyed data.
