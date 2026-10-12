# Admin push notifications

Production panel: https://dashboard.kouponly.in/admin/notifications

A signed-in student opens the native app and allows notifications. The app obtains an
Expo token for EAS project `bc420d39-140b-47c3-98e8-3f5a7499ae0c` and registers it
through `kouponly-mobile-action`. Registration repeats on sign-in, token rotation,
and app resume; sign-out unregisters this device.

Admins can send a title (100 characters), message (500 characters), and optional
HTTPS image to registered devices. The backend enforces two campaigns per Qatar day.
It stores Expo tickets, reports rejected devices, and adds accepted campaigns to the
student's Notifications inbox. Tapping the push opens `/notifications`.

The panel distinguishes Expo acceptance from APNs/FCM confirmation. Neither proves
that an alert was shown: notification permissions, Focus, and device connectivity
still apply. Failure reasons remain visible. Only `DeviceNotRegistered` removes a
device token; credential failures retain it for recovery.

Receipts are checked while the admin panel is open and by the existing
`kouponly-notification-receipts` cron every 15 minutes. The worker uses dedicated
Vault entries `kouponly_push_project_url` and `kouponly_push_service_role_key`.
`KOUPONLY_RECEIPT_WORKER_KEY` must match the latter for its server authorization.
These values are configured securely during deployment, never in browser/mobile env.
The unrelated daily maintenance cron does not share these dedicated entries.

Deployment:

- Deploy `kouponly-admin-action`, `kouponly-mobile-action`, and `kouponly-maintenance`.
- Apply `20261012150000_enable_notification_receipt_worker.sql` and configure the
  worker credentials described above. The migration repairs earlier zero-recipient
  campaigns and refunds their incorrectly consumed quota exactly once.
- Build/deploy the web panel using `web/DEPLOYMENT.md`.
- Build/install the native app with push-capable signing. On iOS automatic signing
  may require Xcode's `-allowProvisioningUpdates` to replace a wildcard profile.
- Android also requires a Firebase configuration file and EAS FCM v1 credentials.
  This checkout does not contain a Firebase configuration; Android device delivery
  must be configured and tested separately.

Verification:

```sh
node --test supabase/tests/push.test.mjs
npm --prefix mobile test -- --runTestsByPath __tests__/couponly-push.test.ts
npm --prefix mobile run typecheck
npm --prefix web run build
```

The updated source was built with push-capable signing, installed, and launched
on the connected iPhone 15 on October 12. Its local token matched the server
registration. The second live admin campaign received an APNs `ok` receipt and
appeared automatically in the foreground Notifications screen without refresh.
The first alert was not seen on the earlier installation. The user also confirmed that the system banner arrived and tapping it opened
Notifications, completing physical iPhone verification. Mirroring pointer input
failed; foreground receipt and inbox updates were observed directly, while banner
and tap behavior were confirmed by the user.

Focused mobile checks passed (20 tests), backend push checks passed (4 tests),
mobile/web TypeScript checks passed, and the web production build passed. The
scheduled receipt cron returned HTTP 200. Qodo review failed twice on the service
without findings; automated external review coverage is incomplete.
