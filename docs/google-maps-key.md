# Android Google Maps key

The Android Gradle build reads `GOOGLE_MAPS_API_KEY` from a Gradle property or the build process environment. Supply a replacement key through your local shell or CI build environment. An entry in `.env.local` alone does not export it to Gradle. Keep the value out of tracked files.

Rotate the key exposed in commit `2a8bf3e` in Google Cloud. Restrict the replacement to Maps SDK for Android and Android application `com.kouponly.app`, with the SHA-1 certificates used for the relevant debug and production builds. Verify maps with a replacement build before deleting the old key if existing installations still depend on it; promptly restrict the old key while transitioning.

Native Maps SDK keys are embedded in the installed Android app, so application and API restrictions remain necessary. Removing the value from the latest source does not remove it from Git history or revoke it. Resolve the GitHub secret-scanning alert only after revocation is confirmed.
