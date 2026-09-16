export type OfflineBackupData = Record<string, unknown>;

export type OfflineBackupEnvelope = {
  format: 'kasir-miso-backup';
  version: 1;
  target: 'offline';
  createdAt: string;
  data: OfflineBackupData;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const offlineArrayFields = [
  'menus',
  'activeOrders',
  'kitchenOrders',
  'inventory',
  'stockMovements',
  'consignments',
  'expenses',
  'sales',
  'auditTrail',
  'savingsRules',
  'savingsEntries',
] as const;

export function createOfflineBackup(data: OfflineBackupData): OfflineBackupEnvelope {
  return {
    format: 'kasir-miso-backup',
    version: 1,
    target: 'offline',
    createdAt: new Date().toISOString(),
    data,
  };
}

export function parseOfflineBackup(raw: string): OfflineBackupEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('File backup bukan JSON yang valid.');
  }

  if (
    !isObjectRecord(parsed)
    || parsed.format !== 'kasir-miso-backup'
    || parsed.version !== 1
    || parsed.target !== 'offline'
    || typeof parsed.createdAt !== 'string'
    || !Number.isFinite(Date.parse(parsed.createdAt))
    || !isObjectRecord(parsed.data)
  ) {
    throw new Error('Format file backup Kasir Miso tidak dikenali.');
  }

  for (const field of offlineArrayFields) {
    if (field in parsed.data && !Array.isArray(parsed.data[field])) {
      throw new Error(`Data backup pada bagian ${field} tidak valid.`);
    }
  }

  if (
    'qrisImageUri' in parsed.data
    && parsed.data.qrisImageUri !== null
    && typeof parsed.data.qrisImageUri !== 'string'
  ) {
    throw new Error('Data QRIS di file backup tidak valid.');
  }

  return {
    format: 'kasir-miso-backup',
    version: 1,
    target: 'offline',
    createdAt: parsed.createdAt,
    data: parsed.data,
  };
}