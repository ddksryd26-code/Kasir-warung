---
name: Artifact import lifecycle
description: Importing an existing app into a generated artifact without losing its registration or workflow metadata.
---

When importing an existing project into a generated artifact, copy the source files while preserving the generated `.replit-artifact/artifact.toml`; replacing or deleting that metadata can unregister the artifact and remove its workflow.

**Why:** The artifact registry owns the generated metadata and workflow wiring, while the uploaded source may contain stale or incompatible metadata from another environment.

**How to apply:** Create the artifact first, then merge the uploaded source around the generated metadata. Change artifact metadata only through the artifact validation flow.