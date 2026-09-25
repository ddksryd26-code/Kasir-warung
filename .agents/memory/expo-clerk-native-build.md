---
name: Clerk native build environment
description: Passing Replit-managed Clerk configuration into Expo native bundles.
---

Replit-managed Clerk provisions `CLERK_PUBLISHABLE_KEY`; Expo native JavaScript only sees the `EXPO_PUBLIC_*` form when the build explicitly bridges it before bundling.

**Why:** An APK built without that bridge falls through to the app's intentional “Login belum tersedia” screen even though Clerk is configured in the workspace.

**How to apply:** Keep the native EAS post-install bridge and fail the build when `CLERK_PUBLISHABLE_KEY` is absent. Keep the provider set to `replit` unless the project explicitly uses external Clerk credentials.