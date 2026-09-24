---
name: Android cloud dependency resolution
description: Dependency pinning needed when Expo or Android cloud builders install with npm instead of the workspace pnpm lock.
---

When the Android builder installs the Expo artifact through the workspace pnpm setup, avoid caret ranges for React test tooling when the app pins React to a specific patch release. A caret can resolve a newer renderer whose peer range requires a newer React patch, causing the install-dependencies phase to fail before native compilation. The cloud builder also treats unlisted dependency build scripts as fatal, so packages reported by `ERR_PNPM_IGNORED_BUILDS` must be explicitly allowlisted.

**Why:** The workspace pnpm lock can keep a compatible older renderer while npm resolves the same caret to the newest incompatible release in a clean cloud environment. Cloud pnpm can enforce build-script approval more strictly than the local install, turning a warning into a failed install.

**How to apply:** Keep `react`, `react-dom`, `react-native`, and `react-test-renderer` aligned; use an exact renderer version when React is exact, update the workspace lockfile, keep `minimumReleaseAge` enabled, and simulate a clean `pnpm install --frozen-lockfile` from the workspace. Add only the specific package names reported as required build scripts to `onlyBuiltDependencies`.