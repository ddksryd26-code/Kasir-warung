---
name: Clerk auth gate in Expo
description: Expo root layouts need an effect-based auth redirect to avoid blank previews while preserving the sign-in route.
---

Use an effect-based `router.replace` auth gate in the Expo root layout instead of returning `Redirect` directly from the root layout. Keep the sign-in route renderable while unauthenticated, and do not mount first-launch or account-specific overlays on that route.

**Why:** Directly rendering `Redirect` from this project's root layout produced a blank preview even though the sign-in route itself loaded correctly.

**How to apply:** When changing authentication routing in the Kasir Miso Expo artifact, render a loading state while redirecting, allow `/sign-in`, and only show app overlays after `isSignedIn` is true.