---
name: Expo OAuth callback scheme
description: Native OAuth callback consistency for Expo apps.
---

The scheme passed to `AuthSession.makeRedirectUri` must exactly match the app's configured Expo scheme.

**Why:** A mismatch can let the provider finish authentication but leave the native app unable to receive the callback, making login appear to fail after returning from Google.

**How to apply:** Before a native build, compare the OAuth redirect scheme with `expo.scheme` in app configuration and keep both identical.