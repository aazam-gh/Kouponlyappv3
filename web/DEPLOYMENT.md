# Admin hosting

The admin uses Cloudflare Pages project `kouponly-admin` in account
`14d099a698f8fa918f9711f75daedd64` and connects directly to Supabase.

Production: https://dashboard.kouponly.in

Run from the repository root:

```sh
npm --prefix web run deploy -- --commit-dirty=true
```

Before deployment, provide `VITE_SUPABASE_URL` and either
`VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY` in `web/.env.local`.
These are public browser configuration; never use a Supabase service role key.
The deployment command builds the app and runs TypeScript checks before uploading.
The repository root supplies the existing Wrangler dependency.
The command explicitly selects the hosting account, Pages project and built files.
Wrangler may warn that the root app's generated Worker configuration is ignored;
the admin deployment uses `web/dist`.

The domain's DNS is managed in the separate `Info@kouponly.in` Cloudflare account
(`564a3bcc2893813f1333549a6d2516f1`). Its DNS-only `dashboard` CNAME points to
`kouponly-admin.pages.dev`; the custom hostname is also registered on the Pages
project. Cloudflare Pages serves the SPA for direct visits to `/admin/...`.

Deployments are manual; pushing code alone does not update this project.
