---
name: Google Drive consent boundary
description: The relationship between Clerk Google login and the separate Google Drive OAuth grant.
---

Google Drive must use its own OAuth consent grant even when the user has just signed into Kasir Miso with Google. The app can launch that consent flow automatically after login, but it cannot silently treat the Clerk session as Drive authorization.

**Why:** Clerk authentication and Google Drive API scopes are separate permissions; requesting Drive access without user consent would be unsafe and is not supported by the existing OAuth design.

**How to apply:** Keep the post-login auto-prompt optional and idempotent, preserve a manual reconnect action after cancellation, and continue storing Drive refresh tokens encrypted on the server.