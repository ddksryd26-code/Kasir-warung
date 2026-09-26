---
name: Artifact-scoped Expo dependencies
description: How to avoid workspace-root package changes when maintaining an Expo artifact in the pnpm monorepo.
---

Package changes for an Expo app must be scoped to that artifact rather than the pnpm workspace root.

**Why:** The generic package installer can invoke `pnpm add` from the workspace root, which pnpm rejects or would place the dependency in the wrong package.

**How to apply:** Use the artifact filter or artifact directory when adding/updating Expo dependencies, then run the Expo compatibility check from that artifact.