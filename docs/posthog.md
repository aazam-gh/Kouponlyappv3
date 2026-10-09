# PostHog setup

The mobile app, admin app, and public site share one PostHog project. Set that project's public project key and regional API host in the matching deployment environment. Keep the key and host empty to leave analytics disabled.

| Client | Project key | API host |
| --- | --- | --- |
| Mobile | `EXPO_PUBLIC_POSTHOG_KEY` | `EXPO_PUBLIC_POSTHOG_HOST` |
| Admin | `VITE_POSTHOG_KEY` | `VITE_POSTHOG_HOST` |
| Public site | `NEXT_PUBLIC_POSTHOG_KEY` | `NEXT_PUBLIC_POSTHOG_HOST` |

The `.env.example` files show the names for each client. Use the host for the region where the PostHog project was created, such as `https://us.i.posthog.com` or `https://eu.i.posthog.com`.

Events currently include screen/page views, offer views and saves on the public site, search submissions, offer saves, and successful coupon redemptions in mobile. The admin app records sanitized route views. Authenticated clients identify users by their Supabase UUID only. Search text, email, names, locations, and route query strings are not sent. Autocapture and session recording are disabled.
