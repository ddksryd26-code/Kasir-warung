---
name: Standalone Expo build dependencies
description: Constraint for remote Android builders receiving only an Expo artifact directory.
---

Remote Android builders may receive only the mobile artifact directory, not the full pnpm monorepo. Dependency installation therefore cannot resolve `workspace:*`, `catalog:`, or packages stored outside that directory.

**Why:** The Android build uploaded successfully but failed during dependency installation while the app depended on a workspace package and catalog specs.

**How to apply:** For a portable Expo artifact, keep runtime workspace packages inside the artifact through a local `file:` dependency, use concrete dependency versions in the artifact package manifest, and validate with a clean standalone npm install before retrying the remote build.

Any Babel preset or plugin named in the app's Babel configuration must also be a direct dependency of the Expo artifact, not merely available transitively in the workspace.

**Why:** Isolated Android builders may not hoist or expose transitive Babel tooling the same way the workspace install does, so Metro can fail before it reaches application source.

**How to apply:** When a remote build reports a missing Babel preset/plugin, compare `babel.config.js` with the Expo artifact's own `package.json` and declare each referenced package directly before retrying.