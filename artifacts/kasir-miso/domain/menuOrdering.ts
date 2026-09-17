import type { MenuItem, WarungState } from '@/context/WarungContext';
import { normalizeShoppingExpenses } from './shoppingExpenses';

export const WARUNG_STATE_STORAGE_KEY = 'warung-state-v2';

export function getWarungStateStorageKey(userId?: string | null) {
  return userId
    ? `${WARUNG_STATE_STORAGE_KEY}:account:${encodeURIComponent(userId)}`
    : WARUNG_STATE_STORAGE_KEY;
}

export function createDefaultWarungState(): WarungState {
  return {
    menus: [],
    activeOrders: [],
    kitchenOrders: [],
    inventory: [],
    stockMovements: [],
    consignments: [],
    expenses: [],
    sales: [],
    auditTrail: [],
    cashClosures: [],
    savingsRules: [],
    savingsEntries: [],
    qrisImageUri: undefined,
  };
}

export function reorderMenuItems(menus: MenuItem[], id: string, toIndex: number) {
  const fromIndex = menus.findIndex((item) => item.id === id);
  if (fromIndex < 0 || toIndex < 0 || toIndex >= menus.length || fromIndex === toIndex) return menus;

  const reordered = [...menus];
  const [moved] = reordered.splice(fromIndex, 1);
  if (!moved) return menus;
  reordered.splice(toIndex, 0, moved);
  return reordered;
}

type PersistImageUri = (uri?: string) => Promise<string | undefined>;
type SetStorageItem = (key: string, value: string) => Promise<void>;
const restoreArrayFields = [
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

export function persistWarungState(
  state: WarungState,
  setItem: SetStorageItem,
  storageKey = WARUNG_STATE_STORAGE_KEY,
) {
  return setItem(storageKey, JSON.stringify(state));
}

export function isRestorableWarungState(value: unknown): value is Partial<WarungState> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const hasStateData = restoreArrayFields.some((field) => field in candidate);
  if (!hasStateData) return false;
  if (restoreArrayFields.some((field) => field in candidate && !Array.isArray(candidate[field]))) return false;
  return !('qrisImageUri' in candidate)
    || candidate.qrisImageUri === null
    || typeof candidate.qrisImageUri === 'string';
}

export async function persistWarungStateSafely(
  previousState: WarungState,
  nextState: WarungState,
  setItem: SetStorageItem,
  storageKey = WARUNG_STATE_STORAGE_KEY,
) {
  try {
    await persistWarungState(nextState, setItem, storageKey);
  } catch (error) {
    try {
      await persistWarungState(previousState, setItem, storageKey);
    } catch {
      // Keep the original write error. The storage adapter may be unavailable.
    }
    throw error;
  }
}

export async function hydrateWarungState(raw: string | null, persistImageUri: PersistImageUri): Promise<WarungState> {
  if (!raw) return createDefaultWarungState();

  try {
    const saved = JSON.parse(raw) as Partial<WarungState>;
    const savedKitchenOrders = Array.isArray(saved.kitchenOrders) ? saved.kitchenOrders : [];
    const savedActiveOrders = Array.isArray(saved.activeOrders) ? saved.activeOrders : [];
    const normalizedActiveOrders = savedActiveOrders.map((order) => ({
      ...order,
      cooked: typeof order.cooked === 'boolean'
        ? order.cooked
        : !savedKitchenOrders.some((kitchenOrder) => kitchenOrder.id === order.id),
    }));
    const menus = Array.isArray(saved.menus)
      ? await Promise.all(saved.menus.map(async (menu) => ({
        ...menu,
        imageUri: await persistImageUri(menu.imageUri),
      })))
      : [];
    const consignments = Array.isArray(saved.consignments)
      ? await Promise.all(saved.consignments.map(async (item) => ({
        ...item,
        imageUri: await persistImageUri(item.imageUri),
      })))
      : [];
    const qrisImageUri = await persistImageUri(saved.qrisImageUri);

    return {
      ...createDefaultWarungState(),
      ...saved,
      menus,
      activeOrders: normalizedActiveOrders,
      kitchenOrders: savedKitchenOrders,
      inventory: Array.isArray(saved.inventory) ? saved.inventory : [],
      stockMovements: Array.isArray(saved.stockMovements) ? saved.stockMovements : [],
      consignments: consignments.map((item) => ({
        ...item,
        packSize: Number(item.packSize) > 0 ? Number(item.packSize) : 1,
      })),
      expenses: normalizeShoppingExpenses(saved.expenses),
      sales: Array.isArray(saved.sales) ? saved.sales : [],
      auditTrail: Array.isArray(saved.auditTrail) ? saved.auditTrail : [],
      cashClosures: Array.isArray(saved.cashClosures) ? saved.cashClosures : [],
      savingsRules: Array.isArray(saved.savingsRules) ? saved.savingsRules : [],
      savingsEntries: Array.isArray(saved.savingsEntries) ? saved.savingsEntries : [],
      qrisImageUri,
    };
  } catch {
    return createDefaultWarungState();
  }
}