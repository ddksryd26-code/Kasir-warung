---
name: Clerk native build environment
description: Passing Replit-managed Clerk configuration into Expo native bundles.
---

Replit-managed Clerk provisions `CLERK_PUBLISHABLE_KEY`; the artifact's Replit build flow is responsible for forwarding it to the `EXPO_PUBLIC_*` form before bundling.

Google native sign-in also requires the four Google values to exist directly in the workspace environment under their `EXPO_PUBLIC_CLERK_GOOGLE_*` names. Shell fallbacks in the Metro dev script are useful for local preview, but do not reliably provide values to Expo Launch's native prebuild.

**Why:** An APK built without that bridge falls through to the app's intentional “Login belum tersedia” screen even though Clerk is configured in the workspace. Replit's native lifecycle hook may run without access to workspace secrets.

**How to apply:** Keep the provider set to `replit` unless the project explicitly uses external Clerk credentials, keep public-key and Google configuration forwarding in the artifact's production build flow, and include the iOS reversed-client-ID URL scheme for iOS builds.