# Vendor account credentials

Admin creation and vendor sign-in remain username/password. Usernames are case-sensitive, 1–128 characters, with no control characters or surrounding whitespace. Passwords created or reset through these actions must be 12–128 characters. Existing passwords continue to work.

The account's internal Supabase Auth email remains the SHA-256 username mapping at `vendor.kouponly.invalid`. Recovery inboxes are stored separately in `kouponly_vendor_recovery`, with RLS enabled and no browser access. Public vendor contact email is never used to authorize recovery.

## Screens

- Admin → Vendors → vendor settings → Account credentials: change username, enroll a recovery inbox, send a password-reset email, or set a new password directly for assisted recovery.
- Standalone vendor panel → Password: enroll/change a recovery inbox using the current password, refresh verification status, or send a reset email.
- Vendor login → Forgot password: request recovery by username. The response does not disclose account existence or delivery status.
- `/credentials#kind=verify&token=…` and `/credentials#kind=reset&token=…`: explicit verification/reset forms. Tokens are removed from the address bar on load and are never submitted on page load, protecting against ordinary email link scanners. Reloading the page requires reopening the email link.

No recovery inbox is assumed for existing accounts. A vendor or administrator must enroll one and the recipient must verify it. Admins can perform assisted password recovery before an inbox has been enrolled.
Older vendor accounts using a real Auth email can request recovery using that existing login too. Account throttles use the resolved user ID so email case variations cannot bypass them.

## Backend and security

`kouponly-vendor-credentials` deliberately allows public requests at the gateway. The function checks the JWT, database admin role, and target vendor membership for every authenticated action. Vendors cannot supply another vendor's ID. Only admins can change usernames or directly set passwords.

Reset and verification secrets contain 256 random bits; only SHA-256 hashes are stored. They expire after 30 minutes and SQL atomically consumes them once. Recovery-email changes, username changes, and password changes invalidate outstanding reset links. Password/username changes also invalidate pending inbox-enrollment links. Existing verified recovery email stays active while a replacement is pending.

Reset links intentionally grant only password replacement, without creating a general-purpose Auth session. Password updates go through Supabase's admin Auth API, which handles password hashing and revokes refresh sessions. Previously issued access JWTs may remain usable until their expiry; this feature does not promise immediate revocation of every access token. Passwords and reset secrets are absent from audit records.

Atomic database throttles limit reset requests to 3 per account per 15 minutes and other credential writes to 5 per account/action per 15 minutes, plus a coarse IP limit. Gateway IP forwarding must remain trustworthy; the account limit does not depend on IP headers. Rate-limit records older than a day are pruned in bounded batches.

Username changes use the Auth admin API's unique email constraint. An Auth trigger checks that the internal email matches the username hash and updates the vendor payload within the same database transaction. This also prevents a vendor from impersonating another username through editable Auth metadata. Vendor IDs, offers, roles, and memberships do not change.

## Release configuration

1. Apply the three `20261019` credential migrations. The second supplies server-only role/membership privileges; the third validates username/email consistency at transaction completion, accommodating GoTrue's separate metadata and email writes.
2. Configure `RESEND_API_KEY`, optional `RESEND_FROM_EMAIL` (defaults to `Kouponly <verification@kouponly.com>`), and **`VENDOR_PANEL_URL`** on the intended Supabase project. Use the working standalone vendor origin, currently `https://kouponly-vendor-panel.pages.dev`; use the custom domain only once DNS/hosting is working. Resend must authorize the sender domain.
3. Deploy `kouponly-vendor-credentials` and the updated `kouponly-admin-action`, then publish both web builds. For the new function, retain `verify_jwt = false`; application-level authorization is mandatory and is implemented in the handler.
4. Set the hosted Auth minimum password length to 12 too. The repository's local config does not automatically update hosted Auth settings. Avoid pushing unrelated mobile redirect settings. This flow uses its own restricted reset tokens, so it does not require changing the mobile Auth callback or the project's site URL.
5. Verify receipt and completion with an inbox you control before claiming email delivery is live. Resend accepting a request is not proof of inbox delivery.

## Checks

```sh
node web/scripts/check-vendor-credentials.mjs
node web/scripts/check-vendor-credential-actions.mjs
# Explicit opt-in: creates/removes temporary live accounts and sends to Resend's simulation address.
node web/scripts/check-vendor-credentials-live.mjs --run-live
supabase db query --linked --file supabase/tests/vendor_credentials.sql
cd web
npm run build
npm run build:vendor
```

The SQL test inserts disposable fixtures and rolls the entire transaction back. Run it after the migration, or combine migration and tests in a rollback transaction to validate against existing database triggers without permanently changing the database. Handler tests use fake transports and never send real emails or change real passwords.

## Release verification — 19 October 2026

Both migrations and both Edge functions were deployed to the existing Kouponly project. The core web release was published at [admin deployment](https://3b88262f.kouponly-admin.pages.dev) and [vendor deployment](https://81fd64a4.kouponly-vendor-panel.pages.dev). Production aliases serve these features. The existing published Home “Save All” change was preserved.

Verified: both production bundles contain the new credential controls; a signed-in vendor can load recovery settings from the deployed backend; unauthorized account/password actions return 401; invalid reset/verification tokens return 400; unknown usernames receive a generic 200 response. SQL tests passed against the actual database, including fixture vendor/role/membership creation under `service_role`, with all fixtures rolled back. Recovery data is unreadable to browser roles.

The final UI changes are published in the same existing hosting account: [admin deployment](https://eb5ba28c.kouponly-admin.pages.dev) and [vendor deployment](https://ceeaa105.kouponly-vendor-panel.pages.dev). Production aliases were checked against the exact final build assets. The vendor stylesheet now explicitly scans the shared credential component; the green buttons were visually verified in a signed-in live vendor session. Credential state remounts when the administrator switches vendor IDs, and status refresh no longer makes a duplicate request.

Live integration tests subsequently passed with disposable admin/vendor accounts: admin account creation, direct password replacement, old-password rejection, username change with old-username rejection, vendor inbox enrollment with current-password verification, Resend send acceptance from admin/vendor/forgot-password actions, one-time verification and recovery completion, and login using the recovered password. Temporary accounts were removed in a finally block. No existing vendor credentials were changed.

The Resend recipient was `delivered@resend.dev`, which simulates delivery. Verification and reset completion used test-seeded secrets because that simulated recipient is not a readable inbox. This proves live Auth/database/reset behavior and Resend request acceptance; it does not prove real inbox receipt or completion using the actual emailed link. Configuring a real Resend receiving inbox remains blocked while local browser access is disabled. The hosted Auth minimum-password setting was not changed globally; these backend creation/reset actions enforce their own 12-character minimum.
