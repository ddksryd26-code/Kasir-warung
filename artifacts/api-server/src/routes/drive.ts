import { ReplitConnectors } from "@replit/connectors-sdk";
import { getAuth } from "@clerk/express";
import { Router, type IRouter } from "express";
import { SaveDriveBackupBody, SaveDriveBackupResponse } from "@workspace/api-zod";

const DRIVE_FILE_MIME_TYPE = "application/json";
const DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const BACKUP_FOLDER_NAME = "Kasir Miso Backups";

type AuthRequest = Parameters<typeof getAuth>[0];
type DriveProxyInit = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

function currentUserId(req: AuthRequest) {
  try {
    return getAuth(req).userId;
  } catch {
    return null;
  }
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function driveRequest(path: string, init?: DriveProxyInit) {
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy("google-drive", path, init);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google Drive request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return response;
}

async function findOrCreateBackupFolder() {
  const query = [
    `name = '${escapeDriveQueryValue(BACKUP_FOLDER_NAME)}'`,
    `mimeType = '${DRIVE_FOLDER_MIME_TYPE}'`,
    "trashed = false",
  ].join(" and ");
  const searchResponse = await driveRequest(
    `/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=1&fields=files(id,name)`,
  );
  const searchResult = (await searchResponse.json()) as {
    files?: Array<{ id?: string; name?: string }>;
  };
  const existingFolder = searchResult.files?.find((file) => file.id);
  if (existingFolder?.id) return existingFolder.id;

  const createResponse = await driveRequest("/drive/v3/files?fields=id,name", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: DRIVE_FOLDER_MIME_TYPE,
    }),
  });
  const createdFolder = (await createResponse.json()) as { id?: string };
  if (!createdFolder.id) {
    throw new Error("Google Drive tidak mengembalikan ID folder backup.");
  }
  return createdFolder.id;
}

function multipartBody(metadata: Record<string, unknown>, content: string) {
  const boundary = `kasir-miso-${Date.now().toString(36)}`;
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

async function uploadBackup(userId: string, state: unknown) {
  const folderId = await findOrCreateBackupFolder();
  const createdAt = new Date();
  const timestamp = createdAt.toISOString().replace(/[:.]/g, "-");
  const fileName = `Kasir Miso - ${userId} - ${timestamp}.json`;
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
    `/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,createdTime`,
    {
      method: "POST",
      headers: { "content-type": multipart.contentType },
      body: multipart.body,
    },
  );
  return (await response.json()) as {
    id?: string;
    name?: string;
    webViewLink?: string;
    createdTime?: string;
  };
}

const router: IRouter = Router();

router.post("/drive/backup", async (req, res) => {
  const userId = currentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const parsed = SaveDriveBackupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid backup state", issues: parsed.error.issues });
    return;
  }

  try {
    const uploaded = await uploadBackup(userId, parsed.data.state);
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
    res.status(502).json({ error: "Backup ke Google Drive gagal. Coba lagi nanti." });
  }
});

export default router;