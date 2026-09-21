---
name: Google Drive backup authentication
description: Durable credential-handling decision for Kasir Miso Google Drive backups.
---

Kasir Miso uses the Replit-managed Google Drive connector and OAuth flow for Drive backups. The app must not ask users to paste a client secret, access token, or refresh token into a form or chat.

**Why:** The user requested three Google credential values, but Replit integrations already provide managed OAuth, token refresh, and scoped access without exposing credentials to the application or storing them in backup data.

**How to apply:** Keep Drive calls server-side through the connector, protect backup routes with the app's existing authentication, and use Replit Secrets only for configuration values that are not supplied by an integration.