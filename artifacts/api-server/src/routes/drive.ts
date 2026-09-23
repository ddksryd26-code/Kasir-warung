import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  ConnectDriveBody,
  DriveImageUploadBody,
  RestoreDriveBackupBody,
  DisconnectDriveResponse,
  DriveConnectionResponse,
  SaveDriveBackupBody,
  SaveDriveBackupResponse,
} from "@workspace/api-zod";
import { db, googleDriveConnections } from "@workspace/db";

const DRIVE_FILE_MIME_TYPE = "application/json";
const DRIVE_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const BACKUP_FOLDER_NAME = "Kasir Miso Backups";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";
const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const DRIVE_API_BASE_URL = "https://www.googleapis.com";

type AuthRequest = Parameters<typeof getAuth>[0];
type Database = typeof db;

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

type GoogleUserInfo = {
  email?: string;
};

function currentUserId(req: AuthRequest) {
  try {
    return getAuth(req).userId;
  } catch {
    return null;
  }
}

function requiredGoogleCredential(name: "GOOGLE_OAUTH_CLIENT_ID" | "GOOGLE_OAUTH_CLIENT_SECRET" | "GOOGLE_TOKEN_ENCRYPTION_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function encryptionKey() {
  return createHash("sha256")
    .update(requiredGoogleCredential("GOOGLE_TOKEN_ENCRYPTION_KEY"))
    .digest();
}

function encryptToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

function decryptToken(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted Google token");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

async function readGoogleJson<T>(response: Response) {
  const payload = await response.json().catch(() => null) as T | { error?: string; error_description?: string } | null;
  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "error_description" in payload
      ? payload.error_description
      : payload && typeof payload === "object" && "error" in payload
        ? payload.error
        : `HTTP ${response.status}`;
    throw new Error(`Google request failed: ${String(detail).slice(0, 200)}`);
  }
  return payload as T;
}

async function exchangeAuthorizationCode(code: string, redirectUri: string, codeVerifier: string) {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requiredGoogleCredential("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: requiredGoogleCredential("GOOGLE_OAUTH_CLIENT_SECRET"),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });
  return readGoogleJson<GoogleTokenResponse>(response);
}

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requiredGoogleCredential("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: requiredGoogleCredential("GOOGLE_OAUTH_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });
  return readGoogleJson<GoogleTokenResponse>(response);
}

async function googleUserInfo(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return readGoogleJson<GoogleUserInfo>(response);
}

async function revokeGoogleToken(token: string) {
  await fetch(GOOGLE_REVOKE_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined);
}

async function getAccessToken(
  userId: string,
  connection: typeof googleDriveConnections.$inferSelect,
  database: Database,
) {
  const expiresAt = connection.accessTokenExpiresAt?.getTime() ?? 0;
  if (connection.encryptedAccessToken && expiresAt > Date.now() + 60_000) {
    return decryptToken(connection.encryptedAccessToken);
  }

  const refreshed = await refreshAccessToken(decryptToken(connection.encryptedRefreshToken));
  if (!refreshed.access_token) throw new Error("Google did not return an access token");
  const nextExpiresAt = new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000);
  await database
    .update(googleDriveConnections)
    .set({
      encryptedAccessToken: encryptToken(refreshed.access_token),
      accessTokenExpiresAt: nextExpiresAt,
      updatedAt: new Date(),
    })
    .where(eq(googleDriveConnections.userId, userId));
  return refreshed.access_token;
}

async function driveRequest(accessToken: string, path: string, init?: RequestInit) {
  const response = await fetch(`${DRIVE_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google Drive request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return response;
}

async function uploadDriveBytes(
  accessToken: string,
  folderId: string,
  metadata: Record<string, unknown>,
  mimeType: string,
  bytes: Buffer,
) {
  const sessionResponse = await driveRequest(
    accessToken,
    "/upload/drive/v3/files?uploadType=resumable",
    {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "x-upload-content-type": mimeType,
        "x-upload-content-length": String(bytes.byteLength),
      },
      body: JSON.stringify({ ...metadata, parents: [folderId] }),
    },
  );
  const uploadUrl = sessionResponse.headers.get("location");
  if (!uploadUrl) throw new Error("Google Drive did not return a resumable upload URL");

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": mimeType,
      "content-length": String(bytes.byteLength),
    },
    body: bytes,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google Drive image upload failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return await response.json() as {
    id?: string;
    name?: string;
    mimeType?: string;
  };
}

async function downloadDriveBytes(accessToken: string, fileId: string) {
  const metadataResponse = await driveRequest(
    accessToken,
    `/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType`,
  );
  const metadata = await metadataResponse.json() as {
    id?: string;
    name?: string;
    mimeType?: string;
  };
  const response = await driveRequest(
    accessToken,
    `/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
  );
  return {
    id: metadata.id ?? fileId,
    name: metadata.name,
    mimeType: metadata.mimeType ?? "application/octet-stream",
    base64: Buffer.from(await response.arrayBuffer()).toString("base64"),
  };
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findOrCreateBackupFolder(accessToken: string) {
  const query = [
    `name = '${escapeDriveQueryValue(BACKUP_FOLDER_NAME)}'`,
    `mimeType = '${DRIVE_FOLDER_MIME_TYPE}'`,
    "trashed = false",
  ].join(" and ");
  const searchResponse = await driveRequest(
    accessToken,
    `/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=1&fields=files(id,name)`,
  );
  const searchResult = await searchResponse.json() as {
    files?: Array<{ id?: string; name?: string }>;
  };
  const existingFolder = searchResult.files?.find((file) => file.id);
  if (existingFolder?.id) return existingFolder.id;

  const createResponse = await driveRequest(accessToken, "/drive/v3/files?fields=id,name", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: DRIVE_FOLDER_MIME_TYPE,
    }),
  });
  const createdFolder = await createResponse.json() as { id?: string };
  if (!createdFolder.id) throw new Error("Google Drive did not return the backup folder ID");
  return createdFolder.id;
}

function multipartBody(metadata: Record<string, unknown>, content: string) {
  const boundary = `kasir-miso-${randomBytes(12).toString("hex")}`;
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${DRIVE_FILE_MIME_TYPE}`,
    "",
    content,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return {
    body,
    contentType: `multipart/related; boundary="${boundary}"`,
  };
}

async function uploadBackup(
  userId: string,
  state: unknown,
  connection: typeof googleDriveConnections.$inferSelect,
  database: Database,
) {
  const accessToken = await getAccessToken(userId, connection, database);
  const folderId = await findOrCreateBackupFolder(accessToken);
  const createdAt = new Date();
  const timestamp = createdAt.toISOString().replace(/[:.]/g, "-");
  const fileName = `Kasir Miso - ${timestamp}.json`;
  const backup = {
    format: "kasir-miso-backup",
    version: 1,
    target: "google-drive",
    createdAt: createdAt.toISOString(),
    data: state,
  };
  const multipart = multipartBody(
    { name: fileName, parents: [folderId], mimeType: DRIVE_FILE_MIME_TYPE },
    JSON.stringify(backup),
  );
  const response = await driveRequest(
    accessToken,
    "/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,createdTime",
    {
      method: "POST",
      headers: { "content-type": multipart.contentType },
      body: multipart.body,
    },
  );
  return await response.json() as {
    id?: string;
    name?: string;
    webViewLink?: string;
    createdTime?: string;
  };
}

async function listBackups(accessToken: string, folderId: string) {
  const query = [
    `'${escapeDriveQueryValue(folderId)}' in parents`,
    "name contains 'Kasir Miso - '",
    `mimeType = '${DRIVE_FILE_MIME_TYPE}'`,
    "trashed = false",
  ].join(" and ");
  const response = await driveRequest(
    accessToken,
    `/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=20&orderBy=createdTime%20desc&fields=files(id,name,createdTime,webViewLink)`,
  );
  const result = await response.json() as {
    files?: Array<{ id?: string; name?: string; createdTime?: string; webViewLink?: string }>;
  };
  return (result.files ?? []).filter((file) => file.id && file.name && file.createdTime).map((file) => ({
    id: file.id as string,
    name: file.name as string,
    createdAt: file.createdTime as string,
    webViewLink: file.webViewLink ?? null,
  }));
}

async function readBackupManifest(accessToken: string, fileId: string) {
  const response = await driveRequest(
    accessToken,
    `/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
  );
  return await response.json() as {
    format?: unknown;
    version?: unknown;
    target?: unknown;
    createdAt?: unknown;
    data?: unknown;
  };
}

function connectionResponse(connection: typeof googleDriveConnections.$inferSelect | undefined) {
  return DriveConnectionResponse.parse({
    connected: Boolean(connection),
    email: connection?.email ?? null,
    connectedAt: connection?.createdAt.toISOString() ?? null,
  });
}

export function createDriveRouter({
  database = db,
  getUserId = currentUserId,
}: {
  database?: Database;
  getUserId?: (req: AuthRequest) => string | null;
} = {}) {
  const router: IRouter = Router();

  router.get("/drive/connection", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const [connection] = await database
      .select()
      .from(googleDriveConnections)
      .where(eq(googleDriveConnections.userId, userId))
      .limit(1);
    res.json(connectionResponse(connection));
  });

  router.post("/drive/oauth/exchange", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const parsed = ConnectDriveBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid Google OAuth exchange", issues: parsed.error.issues });
      return;
    }

    try {
      const [existing] = await database
        .select()
        .from(googleDriveConnections)
        .where(eq(googleDriveConnections.userId, userId))
        .limit(1);
      const token = await exchangeAuthorizationCode(
        parsed.data.code,
        parsed.data.redirectUri,
        parsed.data.codeVerifier,
      );
      if (!token.access_token) throw new Error("Google did not return an access token");
      const userInfo = await googleUserInfo(token.access_token);
      const refreshToken = token.refresh_token
        ? encryptToken(token.refresh_token)
        : existing?.encryptedRefreshToken;
      if (!refreshToken) throw new Error("Google did not return a refresh token; reconnect with consent");

      const now = new Date();
      const accessTokenExpiresAt = new Date(now.getTime() + (token.expires_in ?? 3600) * 1000);
      const [saved] = await database
        .insert(googleDriveConnections)
        .values({
          userId,
          encryptedRefreshToken: refreshToken,
          encryptedAccessToken: encryptToken(token.access_token),
          accessTokenExpiresAt,
          email: userInfo.email ?? null,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: googleDriveConnections.userId,
          set: {
            encryptedRefreshToken: refreshToken,
            encryptedAccessToken: encryptToken(token.access_token),
            accessTokenExpiresAt,
            email: userInfo.email ?? existing?.email ?? null,
            updatedAt: now,
          },
        })
        .returning();
      res.json(connectionResponse(saved));
    } catch (error) {
      req.log.error({ err: error }, "Google Drive OAuth exchange failed");
      res.status(502).json({ error: "Google Drive belum berhasil dihubungkan. Coba lagi." });
    }
  });

  router.delete("/drive/oauth/disconnect", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const [connection] = await database
      .select()
      .from(googleDriveConnections)
      .where(eq(googleDriveConnections.userId, userId))
      .limit(1);
    if (connection) {
      try {
        await revokeGoogleToken(decryptToken(connection.encryptedRefreshToken));
      } catch (error) {
        req.log.warn({ err: error }, "Google Drive token revocation failed");
      }
      await database
        .delete(googleDriveConnections)
        .where(eq(googleDriveConnections.userId, userId));
    }
    res.json(DisconnectDriveResponse.parse({ disconnected: true }));
  });

  router.post("/drive/backup", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const parsed = SaveDriveBackupBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid backup state", issues: parsed.error.issues });
      return;
    }

    const [connection] = await database
      .select()
      .from(googleDriveConnections)
      .where(eq(googleDriveConnections.userId, userId))
      .limit(1);
    if (!connection) {
      res.status(409).json({ error: "Google Drive belum terhubung untuk akun ini" });
      return;
    }

    try {
      const uploaded = await uploadBackup(userId, parsed.data.state, connection, database);
      if (!uploaded.id || !uploaded.name || !uploaded.createdTime) {
        res.status(502).json({ error: "Google Drive tidak mengembalikan metadata backup lengkap." });
        return;
      }
      res.json(SaveDriveBackupResponse.parse({
        id: uploaded.id,
        name: uploaded.name,
        webViewLink: uploaded.webViewLink ?? null,
        createdAt: uploaded.createdTime,
      }));
    } catch (error) {
      req.log.error({ err: error }, "Google Drive backup failed");
      res.status(502).json({ error: "Backup ke Google Drive gagal. Coba hubungkan ulang lalu coba lagi." });
    }
  });

  router.post("/drive/image", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const parsed = DriveImageUploadBody.safeParse(req.body);
    if (!parsed.success || !DRIVE_IMAGE_MIME_TYPES.has(parsed.data?.mimeType ?? "")) {
      res.status(400).json({ error: "Invalid backup image" });
      return;
    }

    const [connection] = await database
      .select()
      .from(googleDriveConnections)
      .where(eq(googleDriveConnections.userId, userId))
      .limit(1);
    if (!connection) {
      res.status(409).json({ error: "Google Drive belum terhubung untuk akun ini" });
      return;
    }

    try {
      const bytes = Buffer.from(parsed.data.base64, "base64");
      if (bytes.byteLength === 0 || bytes.byteLength > 8 * 1024 * 1024) {
        res.status(400).json({ error: "Ukuran gambar backup harus lebih dari 0 dan maksimal 8 MB." });
        return;
      }
      const accessToken = await getAccessToken(userId, connection, database);
      const folderId = await findOrCreateBackupFolder(accessToken);
      const safeFileName = parsed.data.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "image";
      const uploaded = await uploadDriveBytes(
        accessToken,
        folderId,
        {
          name: `Kasir Miso Image - ${Date.now()} - ${safeFileName}`,
          mimeType: parsed.data.mimeType,
        },
        parsed.data.mimeType,
        bytes,
      );
      if (!uploaded.id) {
        res.status(502).json({ error: "Google Drive tidak mengembalikan ID gambar." });
        return;
      }
      res.json({
        id: uploaded.id,
        name: uploaded.name ?? safeFileName,
        mimeType: uploaded.mimeType ?? parsed.data.mimeType,
      });
    } catch (error) {
      req.log.error({ err: error }, "Google Drive image upload failed");
      res.status(502).json({ error: "Gambar backup ke Google Drive gagal. Coba lagi." });
    }
  });

  router.get("/drive/image/:fileId", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const [connection] = await database
      .select()
      .from(googleDriveConnections)
      .where(eq(googleDriveConnections.userId, userId))
      .limit(1);
    if (!connection) {
      res.status(409).json({ error: "Google Drive belum terhubung untuk akun ini" });
      return;
    }

    try {
      const accessToken = await getAccessToken(userId, connection, database);
      const image = await downloadDriveBytes(accessToken, req.params.fileId);
      if (!DRIVE_IMAGE_MIME_TYPES.has(image.mimeType)) {
        res.status(404).json({ error: "File backup bukan gambar yang didukung." });
        return;
      }
      res.json(image);
    } catch (error) {
      req.log.error({ err: error }, "Google Drive image download failed");
      res.status(502).json({ error: "Gambar backup dari Google Drive gagal diunduh." });
    }
  });

  router.get("/drive/backups", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const [connection] = await database
      .select()
      .from(googleDriveConnections)
      .where(eq(googleDriveConnections.userId, userId))
      .limit(1);
    if (!connection) {
      res.status(409).json({ error: "Google Drive belum terhubung untuk akun ini" });
      return;
    }

    try {
      const accessToken = await getAccessToken(userId, connection, database);
      const folderId = await findOrCreateBackupFolder(accessToken);
      res.json({ backups: await listBackups(accessToken, folderId) });
    } catch (error) {
      req.log.error({ err: error }, "Google Drive backup listing failed");
      res.status(502).json({ error: "Daftar backup Google Drive gagal dibaca." });
    }
  });

  router.post("/drive/restore", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const parsed = RestoreDriveBackupBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Backup Google Drive tidak valid." });
      return;
    }

    const [connection] = await database
      .select()
      .from(googleDriveConnections)
      .where(eq(googleDriveConnections.userId, userId))
      .limit(1);
    if (!connection) {
      res.status(409).json({ error: "Google Drive belum terhubung untuk akun ini" });
      return;
    }

    try {
      const accessToken = await getAccessToken(userId, connection, database);
      const manifest = await readBackupManifest(accessToken, parsed.data.fileId);
      if (
        manifest.format !== "kasir-miso-backup"
        || manifest.version !== 1
        || manifest.target !== "google-drive"
        || typeof manifest.createdAt !== "string"
        || !manifest.data
        || typeof manifest.data !== "object"
      ) {
        res.status(400).json({ error: "Format backup Google Drive tidak dikenali." });
        return;
      }
      res.json({
        format: "kasir-miso-backup",
        version: 1,
        target: "google-drive",
        createdAt: manifest.createdAt,
        data: manifest.data,
      });
    } catch (error) {
      req.log.error({ err: error }, "Google Drive manifest restore failed");
      res.status(502).json({ error: "Backup Google Drive gagal dibaca." });
    }
  });

  return router;
}

const router = createDriveRouter();
export default router;