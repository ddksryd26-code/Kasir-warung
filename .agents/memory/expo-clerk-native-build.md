---
name: Clerk native build environment
description: Passing Replit-managed Clerk configuration into Expo native bundles.
---

Replit-managed Clerk provisions `CLERK_PUBLISHABLE_KEY`; the artifact's Replit build flow is responsible for forwarding it to the `EXPO_PUBLIC_*` form before bundling.

**Why:** An APK built without that bridge falls through to the app's intentional “Login belum tersedia” screen even though Clerk is configured in the workspace. Replit's native lifecycle hook may run without access to workspace secrets.

**How to apply:** Keep the provider set to `replit` unless the project explicitly uses external Clerk credentials, and keep public-key forwarding in the artifact's production build script rather than an EAS lifecycle hook.