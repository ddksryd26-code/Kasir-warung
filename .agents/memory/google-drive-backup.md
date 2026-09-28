---
name: Google Drive backup authentication
description: Durable credential-handling decision for Kasir Miso Google Drive backups.
---

Kasir Miso uses a per-user Google OAuth connection for Drive backups. Each signed-in Clerk user has a separate encrypted token record and uploads into that user's Google Drive. Native Android/iOS flows use PKCE and may not have a client secret; web OAuth may use a server-side client secret. The app must not ask users to paste an access token or refresh token into a form or chat.

**Why:** The product requirement is one Google Drive per Kasir Miso account. A single Replit-managed connector connection would share one Drive across all app users, so OAuth authorization must happen per user while client secrets and tokens stay server-side.

**How to apply:** Protect Drive routes with Clerk, exchange PKCE authorization codes on the server, encrypt refresh/access tokens before storing them, and use each user's token for Drive API calls. Keep the OAuth client ID and encryption key in Replit Secrets; keep a client secret server-only when the selected OAuth client type requires one.