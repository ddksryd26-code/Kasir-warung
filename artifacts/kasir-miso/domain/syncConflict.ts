import type { WarungState } from '@/context/WarungContext';

const collectionKeys = [
  'menus',
  'activeOrders',
  'kitchenOrders',
  'inventory',
  'stockMovements',
  'consignments',
  'expenses',
  'sales',
  'auditTrail',
  'cashClosures',
  'savingsRules',
  'savingsEntries',
] as const;

type CollectionKey = (typeof collectionKeys)[number];
type CollectionItem = { id?: string } & Record<string, unknown>;

function mergeCollection(local: CollectionItem[] | undefined, remote: CollectionItem[] | undefined) {
  const merged = [...(remote ?? [])];
  for (const localItem of local ?? []) {
    const index = localItem.id
      ? merged.findIndex((remoteItem) => remoteItem.id === localItem.id)
      : -1;
    if (index >= 0) merged[index] = localItem;
    else merged.push(localItem);
  }
  return merged;
}

export function mergeWarungStates(local: WarungState, remote: WarungState): WarungState {
  const merged = {
    ...remote,
    ...local,
    qrisImageUri: local.qrisImageUri ?? remote.qrisImageUri,
  };

  for (const key of collectionKeys) {
    merged[key] = mergeCollection(
      local[key] as unknown as CollectionItem[] | undefined,
      remote[key] as unknown as CollectionItem[] | undefined,
    ) as never;
  }

  return merged;
}

export function stateSnapshotKey(state: WarungState) {
  return JSON.stringify(state);
}

export type SyncMetadata = {
  version: number | null;
  syncedState: WarungState;
};

export function parseSyncMetadata(raw: string | null): SyncMetadata | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SyncMetadata>;
    if (
      typeof parsed.version !== 'number'
      || !parsed.syncedState
      || typeof parsed.syncedState !== 'object'
    ) return null;
    return parsed as SyncMetadata;
  } catch {
    return null;
  }
}

export function isCollectionKey(key: string): key is CollectionKey {
  return collectionKeys.includes(key as CollectionKey);
}