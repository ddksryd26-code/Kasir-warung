---
name: Cloud sync schema lifecycle
description: Database schema application rule for Kasir Miso cloud sync and Google Drive connections.
---

Cloud sync and Google Drive connection endpoints depend on the database schema being applied in the development database before runtime testing.

**Why:** The schema source existed, but the running API returned 500 for both cloud state and Drive connection queries until the development schema was pushed and the API workflow restarted.

**How to apply:** After adding or changing cloud tables, use the project's development schema push flow, restart the API, verify the tables and endpoints, and rely on Publish to apply the corresponding schema to production.