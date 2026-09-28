---
name: Expo DevTools on Nix
description: React Native DevTools may fail to launch because its downloaded desktop binary expects Linux GUI libraries that are not in the base environment.
---

Metro can start and Expo Go can preview the app even when the React Native DevTools helper logs a missing shared-library error. Do not treat that helper failure as an application crash.

**Why:** The DevTools binary is a separate desktop process from Metro, and its missing system libraries can appear one at a time during startup.

**How to apply:** Verify the workflow reaches the Expo QR/Web URL and run the app's typecheck and tests before changing app code. Install missing Nix system libraries only when desktop DevTools support is needed; do not block the mobile preview on this warning.