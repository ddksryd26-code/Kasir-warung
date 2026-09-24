---
name: Android cloud dependency resolution
description: Dependency pinning needed when Expo or Android cloud builders install with npm instead of the workspace pnpm lock.
---

When the Android builder installs the Expo artifact as a standalone npm project, avoid caret ranges for React test tooling when the app pins React to a specific patch release. A caret can resolve a newer renderer whose peer range requires a newer React patch, causing the install-dependencies phase to fail before native compilation.

**Why:** The workspace pnpm lock can keep a compatible older renderer while npm resolves the same caret to the newest incompatible release in a clean cloud environment.

**How to apply:** Keep `react`, `react-dom`, `react-native`, and `react-test-renderer` aligned; use an exact renderer version when React is exact, update the workspace lockfile, and simulate a clean `npm install` from the artifact directory before retrying Android builds.