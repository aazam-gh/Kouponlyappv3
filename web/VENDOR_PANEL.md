# Vendor Panel

The Vendor Panel is a separate, vendor-only web build. It shares the existing Supabase project and vendor-scoped reporting queries, but has its own entry point and build output so the admin router and admin screens are not included.

## Included access

- Username or email plus password sign-in.
- Dashboard analytics and revenue chart.
- Read-only transaction history with date filters.
- Read-only business profile.
- Sign out.

The signed-in Supabase user must have one `owner` or `manager` row in `couponly_vendor_memberships`. The reporting RPCs independently check vendor membership before returning data. The browser derives the vendor ID from that membership instead of accepting a vendor ID from a URL or form. The Vendor Panel does not expose admin routes, support-request forms, or vendor write actions.

## Local development

From `web/`, run `npm run dev:vendor` and open `http://localhost:3002/`. The standalone UI uses the same public Supabase environment values as the admin (`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, or `VITE_SUPABASE_ANON_KEY`).

## Build and deploy

`npm run build:vendor` builds the standalone `dist-vendor/` site and type-checks the source. `npm run deploy:vendor` publishes it to Cloudflare Pages project `kouponly-vendor-panel` on branch `main`.

Configure the project’s Pages custom domain as `dashboard.vendor.kouponly.in` after the hostname's zone is available in the Cloudflare account. The custom domain is a hosting/DNS configuration and is not created by this source build.
