import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@clerk/expo';
import { saveWarungState, getWarungState } from '@workspace/api-client-react';
import { persistImageUri } from '@/utils/persistentImage';
import { appendOrderItems, cancelActiveOrder, submitOrder } from '@/domain/warungTransactions';
import { addShoppingExpense as addShoppingExpenseToState } from '@/domain/shoppingExpenses';
import {
  createDefaultWarungState,
  getWarungStateStorageKey,
  hydrateWarungState,
  isRestorableWarungState,
  persistWarungState,
  persistWarungStateSafely,
  reorderMenuItems,
  WARUNG_STATE_STORAGE_KEY,
} from '@/domain/menuOrdering';

export type MenuKey = string;
export type PaymentMethod = 'Tunai' | 'QRIS';
export type SaleStatus = 'completed' | 'refunded';
export type DiscountType = 'none' | 'percent' | 'amount';
export interface MenuVariant { id: string; name: string; priceDelta: number }
export interface MenuItem { id: string; name: string; price: number; recipe: Record<string, number>; category?: string; imageUri?: string; variants?: MenuVariant[] }
export interface OrderItem {
  menu: MenuKey;
  qty: number;
  note?: string;
  variantId?: string;
  variantName?: string;
  /** Immutable catalog values captured when the item is submitted. */
  displayName?: string;
  unitPrice?: number;
  recipe?: Record<string, number>;
  /** Per-piece amount owed to a consignor. */
  consignmentUnitCost?: number;
}
export interface ActiveOrder {
  id: string;
  tables: number[];
  pax: number;
  items: OrderItem[];
  note: string;
  createdAt: string;
  cooked?: boolean;
  pendingItems?: OrderItem[];
  isAdditional?: boolean;
  parentOrderId?: string;
}
export interface Sale {
  id: string;
  receiptNumber?: string;
  amount: number;
  method: PaymentMethod;
  items: OrderItem[];
  date: string;
  tables?: number[];
  paidAt?: string;
  received?: number;
  change?: number;
  status?: SaleStatus;
  refundedAt?: string;
  refundReason?: string;
  subtotal?: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountAmount?: number;
}
export type AuditAction = 'order_cancelled' | 'sale_refunded';
export interface AuditEntry {
  id: string;
  action: AuditAction;
  entityId: string;
  description: string;
  date: string;
  amount?: number;
}
export interface CashClosure {
  id: string;
  date: string;
  closedAt: string;
  openingCash: number;
  cashSales: number;
  qrisSales: number;
  cashExpenses: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  saleIds: string[];
  notes?: string;
}
export interface InventoryItem { id: string; name: string; unit: string; qty: number; safe: number; cost?: number }
export interface StockMovement {
  id: string;
  inventoryId: string;
  quantity: number;
  unit: string;
  reason?: string;
  date: string;
}
export interface ConsignmentItem {
  id: string;
  name: string;
  imageUri?: string;
  /** Harga yang dibayarkan ke penitip untuk satu plastik. */
  cost: number;
  /** Harga jual untuk satu biji. */
  sellPrice: number;
  /** Jumlah biji dalam satu plastik. */
  packSize: number;
  /** Stok disimpan dalam satuan biji. */
  qty: number;
}
export interface Expense { id: string; title: string; amount: number; date: string; shoppingItemId?: string }
export interface SavingsRule {
  id: string;
  name: string;
  inventoryId: string;
  amountPerItem: number;
  savedAmount: number;
  savedQty: number;
}
export interface SavingsEntry {
  id: string;
  name: string;
  inventoryId: string;
  consignmentId?: string;
  qty: number;
  amount: number;
  date: string;
}

const padDatePart = (value: number) => String(value).padStart(2, '0');

export const localDate = (date: Date = new Date()) => {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
};

export type ReportPeriod = 'Hari ini' | 'Minggu ini' | 'Bulan ini';

export function isDateInReportPeriod(date: string, period: ReportPeriod, now: Date = new Date()) {
  const today = localDate(now);
  if (period === 'Hari ini') return date === today;
  if (period === 'Bulan ini') return date.slice(0, 7) === today.slice(0, 7);

  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceMonday = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - daysSinceMonday);
  const startDate = localDate(weekStart);
  return date >= startDate && date <= today;
}
export interface WarungState {
  menus: MenuItem[]; activeOrders: ActiveOrder[]; kitchenOrders: ActiveOrder[]; inventory: InventoryItem[]; stockMovements?: StockMovement[]; consignments: ConsignmentItem[]; expenses: Expense[]; sales: Sale[]; auditTrail?: AuditEntry[]; cashClosures: CashClosure[]; savingsRules: SavingsRule[]; savingsEntries: SavingsEntry[]; qrisImageUri?: string;
}
type ApiWarungState = Parameters<typeof saveWarungState>[0]['state'];

const toApiWarungState = (value: WarungState) => value as unknown as ApiWarungState;

interface ContextValue extends WarungState {
  hydrated: boolean;
  restoreState: (nextState: unknown) => Promise<void>;
  addMenu: (name: string, price: number, recipe?: Record<string, number>, category?: string, imageUri?: string, variants?: MenuVariant[]) => void;
  updateMenu: (id: string, name: string, price: number, recipe?: Record<string, number>, category?: string, imageUri?: string, variants?: MenuVariant[]) => void;
  deleteMenu: (id: string) => void;
  reorderMenus: (id: string, toIndex: number) => void;
  addInventoryItem: (name: string, unit: string, qty: number, safe: number, cost?: number) => void;
  updateInventoryItem: (id: string, name: string, unit: string, qty: number, safe: number, cost?: number) => void;
  deleteInventoryItem: (id: string) => void;
  addConsignment: (name: string, cost: number, sellPrice: number, qty: number, packSize?: number, imageUri?: string) => void;
  updateConsignment: (id: string, name: string, cost: number, sellPrice: number, qty: number, packSize?: number, imageUri?: string) => void;
  deleteConsignment: (id: string) => void;
  addConsignmentStock: (id: string, qty: number) => void;
  removeConsignmentStock: (id: string, qty: number) => void;
  consumeConsignmentItems: (items: OrderItem[]) => void;
  restoreConsignmentItems: (items: OrderItem[]) => void;
  addOrder: (tables: number[], pax: number, items: OrderItem[], note: string) => void;
  updateOrderTables: (id: string, tables: number[]) => void;
  addItems: (id: string, items: OrderItem[], note: string) => void;
  completeKitchen: (id: string) => void;
  mergeOrders: (targetId: string, sourceId: string) => void;
  payOrder: (id: string, amount: number, method: PaymentMethod, receiptNumber?: string, received?: number, change?: number) => void;
  consumeItems: (items: OrderItem[]) => void;
  restoreItems: (items: OrderItem[]) => void;
  addStock: (id: string, qty: number, reason?: string) => void;
  removeStock: (id: string, qty: number) => void;
  addExpense: (title: string, amount: number) => void;
  closeCash: (openingCash: number, cashExpenses: number, countedCash: number, saleIds: string[], notes?: string) => void;
  addShoppingExpense: (shoppingItemId: string, title: string, amount: number) => void;
  addSavingsRule: (name: string, inventoryId: string, amountPerItem: number) => void;
  addManualSaving: (name: string, amount: number) => void;
  useSavings: (sourceId: string, sourceType: 'rule' | 'manual' | 'consignment', amount: number) => void;
  deleteSavingsRule: (id: string) => void;
  setQrisImageUri: (uri: string) => void;
  cancelOrder: (id: string) => void;
  refundSale: (id: string, reason: string) => void;
}
const WarungContext = createContext<ContextValue | null>(null);
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export function WarungProvider({ children }: { children: ReactNode }) {
  const { isLoaded: authLoaded, userId } = useAuth();
  const [state, setState] = useState<WarungState>(createDefaultWarungState);
  const [hydrated, setHydrated] = useState(false);
  const storageKey = getWarungStateStorageKey(userId);
  useEffect(() => {
    if (!authLoaded) return;
    let mounted = true;
    setHydrated(false);
    setState(createDefaultWarungState());

    const loadState = async () => {
      const localRaw = await AsyncStorage.getItem(storageKey);
      const legacyRaw = userId && localRaw === null
        ? await AsyncStorage.getItem(WARUNG_STATE_STORAGE_KEY)
        : null;
      let nextState = await hydrateWarungState(localRaw ?? legacyRaw, persistImageUri);

      if (userId) {
        try {
          const remote = await getWarungState();
          if (isRestorableWarungState(remote.state)) {
            nextState = await hydrateWarungState(JSON.stringify(remote.state), persistImageUri);
          }
        } catch (error) {
          if ((error as { status?: number }).status !== 404) {
            // Keep the local snapshot when the device is offline or the API is unavailable.
          }
          if ((error as { status?: number }).status === 404) {
            try {
              await saveWarungState({ state: toApiWarungState(nextState) });
            } catch {
              // Keep the local snapshot when the first cloud upload is offline.
            }
          }
        }
      }

      await persistWarungState(nextState, AsyncStorage.setItem, storageKey);
      if (userId && legacyRaw !== null) {
        await AsyncStorage.removeItem(WARUNG_STATE_STORAGE_KEY);
      }
      if (mounted) {
        setState(nextState);
        setHydrated(true);
      }
    };

    void loadState().catch(() => {
      if (mounted) {
        setState(createDefaultWarungState());
        setHydrated(true);
      }
    });
    return () => { mounted = false; };
  }, [authLoaded, storageKey, userId]);
  useEffect(() => {
    if (hydrated) {
      void persistWarungState(state, AsyncStorage.setItem, storageKey);
    }
  }, [hydrated, state, storageKey]);
  useEffect(() => {
    if (!hydrated || !userId) return;
    const timeout = setTimeout(() => {
      void saveWarungState({ state: toApiWarungState(state) }).catch(() => {
        // AsyncStorage remains the source of truth while offline; retry on the next change.
      });
    }, 750);
    return () => clearTimeout(timeout);
  }, [hydrated, state, userId]);
  useEffect(() => {
    if (!hydrated || !userId) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      void saveWarungState({ state: toApiWarungState(state) }).catch(() => {
        // Keep the local snapshot when the API is still unavailable.
      });
    });
    return () => subscription.remove();
  }, [hydrated, state, userId]);
  const value = useMemo<ContextValue>(() => ({
    ...state,
    hydrated,
    restoreState: async nextState => {
      if (!isRestorableWarungState(nextState)) {
        throw new Error('Data backup tidak memiliki bentuk state Kasir Miso yang valid.');
      }
      const restored = await hydrateWarungState(JSON.stringify(nextState), persistImageUri);
      await persistWarungStateSafely(state, restored, AsyncStorage.setItem, storageKey);
      setState(restored);
    },
    addMenu: (name, price, recipe = {}, category = 'Lainnya', imageUri, variants = []) => setState(s => ({ ...s, menus: [...s.menus, { id: makeId(), name, price, recipe, category, imageUri, variants }] })),
    updateMenu: (id, name, price, recipe = {}, category = 'Lainnya', imageUri, variants = []) => setState(s => ({ ...s, menus: s.menus.map(item => item.id === id ? { ...item, name, price, recipe, category, imageUri, variants } : item) })),
    deleteMenu: id => setState(s => ({ ...s, menus: s.menus.filter(item => item.id !== id) })),
      reorderMenus: (id, toIndex) => setState(s => {
        const menus = reorderMenuItems(s.menus, id, toIndex);
        return menus === s.menus ? s : { ...s, menus };
      }),
    addInventoryItem: (name, unit, qty, safe, cost = 0) => setState(s => {
      const id = makeId();
      return {
        ...s,
        inventory: [...s.inventory, { id, name, unit, qty, safe, cost }],
        stockMovements: qty > 0
          ? [...(s.stockMovements ?? []), { id: makeId(), inventoryId: id, quantity: qty, unit, reason: 'Stok awal', date: localDate() }]
          : s.stockMovements,
      };
    }),
     updateInventoryItem: (id, name, unit, qty, safe, cost = 0) => setState(s => ({ ...s, inventory: s.inventory.map(item => item.id === id ? { ...item, name, unit, qty, safe, cost } : item) })),
     deleteInventoryItem: id => setState(s => ({ ...s, inventory: s.inventory.filter(item => item.id !== id) })),
      addConsignment: (name, cost, sellPrice, qty, packSize = 10, imageUri) => setState(s => ({ ...s, consignments: [...s.consignments, { id: makeId(), name, cost, sellPrice, packSize, qty, imageUri }] })),
      updateConsignment: (id, name, cost, sellPrice, qty, packSize = 10, imageUri) => setState(s => ({ ...s, consignments: s.consignments.map(item => item.id === id ? { ...item, name, cost, sellPrice, packSize, qty, imageUri } : item) })),
     deleteConsignment: id => setState(s => ({ ...s, consignments: s.consignments.filter(item => item.id !== id) })),
     addConsignmentStock: (id, qty) => setState(s => ({ ...s, consignments: s.consignments.map(item => item.id === id ? { ...item, qty: item.qty + qty } : item) })),
     removeConsignmentStock: (id, qty) => setState(s => ({ ...s, consignments: s.consignments.map(item => item.id === id ? { ...item, qty: Math.max(0, item.qty - qty) } : item) })),
     consumeConsignmentItems: items => setState(s => ({
       ...s,
       consignments: s.consignments.map(item => {
         const key = consignmentKey(item.id);
         const used = items.filter(entry => entry.menu === key).reduce((sum, entry) => sum + entry.qty, 0);
         return used ? { ...item, qty: Math.max(0, item.qty - used) } : item;
       }),
     })),
     restoreConsignmentItems: items => setState(s => ({
       ...s,
       consignments: s.consignments.map(item => {
         const key = consignmentKey(item.id);
         const restored = items.filter(entry => entry.menu === key).reduce((sum, entry) => sum + entry.qty, 0);
         return restored ? { ...item, qty: item.qty + restored } : item;
       }),
     })),
      addOrder: (tables, pax, items, note) => setState(s => submitOrder(
        s,
        { tables, pax, items, note },
        makeId,
        new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      )),
     updateOrderTables: (id, tables) => setState(s => {
       const update = (order: ActiveOrder) => order.id === id || order.parentOrderId === id ? { ...order, tables } : order;
       return { ...s, activeOrders: s.activeOrders.map(update), kitchenOrders: s.kitchenOrders.map(update) };
     }),
      addItems: (id, items, note) => setState(s => appendOrderItems(s, id, items, note, makeId)),
     completeKitchen: id => setState(s => {
       const kitchenOrder = s.kitchenOrders.find((order) => order.id === id);
       if (!kitchenOrder) return s;

       if (kitchenOrder.isAdditional && kitchenOrder.parentOrderId) {
         const parent = s.activeOrders.find((order) => order.id === kitchenOrder.parentOrderId);
         if (!parent) return { ...s, kitchenOrders: s.kitchenOrders.filter((order) => order.id !== id) };
         const remainingAdditional = s.kitchenOrders.filter(
           (order) => order.id !== id && order.isAdditional && order.parentOrderId === parent.id,
         );
         const remainingItems = remainingAdditional.flatMap((order) => order.items);
         const updatedParent: ActiveOrder = {
           ...parent,
           items: mergeOrderItems(parent.items, kitchenOrder.items),
           pendingItems: remainingItems.length ? mergeOrderItems([], remainingItems) : undefined,
           cooked: remainingAdditional.length === 0,
         };
         return {
           ...s,
           activeOrders: s.activeOrders.map((order) => order.id === parent.id ? updatedParent : order),
           kitchenOrders: s.kitchenOrders.filter((order) => order.id !== id),
         };
       }

       return {
         ...s,
         activeOrders: s.activeOrders.map(o => o.id === id ? { ...o, cooked: true } : o),
         kitchenOrders: s.kitchenOrders.filter(o => o.id !== id),
       };
     }),
    mergeOrders: (targetId, sourceId) => setState(s => {
      const target = s.activeOrders.find(o => o.id === targetId);
      const source = s.activeOrders.find(o => o.id === sourceId);
      if (!target || !source || target.id === source.id) return s;
       const mergedItems = mergeOrderItems(target.items, source.items);
       const mergedPendingItems = mergeOrderItems(target.pendingItems || [], source.pendingItems || []);
      const merged = {
        ...target,
        tables: [...new Set([...target.tables, ...source.tables])],
        pax: target.pax + source.pax,
        items: mergedItems,
         pendingItems: mergedPendingItems.length ? mergedPendingItems : undefined,
        note: [target.note, source.note].filter(Boolean).join(' · '),
         cooked: Boolean(target.cooked && source.cooked && !mergedPendingItems.length),
      };
       const relatedKitchenOrders = s.kitchenOrders.filter(
         (order) => order.id === targetId
           || order.id === sourceId
           || order.parentOrderId === targetId
           || order.parentOrderId === sourceId,
       );
       const remainingKitchenOrders = s.kitchenOrders.filter((order) => !relatedKitchenOrders.includes(order));
       const mainKitchenOrder = relatedKitchenOrders.find((order) => !order.isAdditional);
       const mergedKitchenOrder = merged.cooked
         ? null
         : mainKitchenOrder
           ? { ...merged, id: targetId, isAdditional: undefined, parentOrderId: undefined }
           : mergedPendingItems.length
             ? { ...merged, id: makeId(), items: mergedPendingItems, pendingItems: undefined, isAdditional: true, parentOrderId: targetId }
             : { ...merged, id: targetId };
      return {
        ...s,
        activeOrders: s.activeOrders.filter(o => o.id !== sourceId).map(o => o.id === targetId ? merged : o),
         kitchenOrders: mergedKitchenOrder ? [...remainingKitchenOrders, mergedKitchenOrder] : remainingKitchenOrders,
      };
    }),
      payOrder: (id, amount, method, receiptNumber, received, change) => setState(s => {
        const order = s.activeOrders.find(o => o.id === id);
        return order?.cooked ? {
          ...s,
          activeOrders: s.activeOrders.filter(o => o.id !== id),
          kitchenOrders: s.kitchenOrders.filter(o => o.id !== id),
          sales: [
            ...s.sales,
            {
              id: makeId(),
              receiptNumber,
              amount,
              method,
               items: getOrderItems(order),
              tables: order.tables,
              date: localDate(),
              paidAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
              status: 'completed',
              received,
              change,
            },
          ],
          savingsRules: s.savingsRules.map((rule) => {
              const savedQty = getOrderItems(order).reduce((total, item) => total + (item.recipe?.[rule.inventoryId] ?? s.menus.find((menu) => menu.id === item.menu)?.recipe[rule.inventoryId] ?? 0) * item.qty, 0);
            return savedQty
              ? { ...rule, savedQty: (rule.savedQty || 0) + savedQty, savedAmount: rule.savedAmount + savedQty * rule.amountPerItem }
              : rule;
          }),
          savingsEntries: [
            ...s.savingsEntries,
            ...s.savingsRules.flatMap((rule) => {
               const qty = getOrderItems(order).reduce((total, item) => total + (item.recipe?.[rule.inventoryId] ?? s.menus.find((menu) => menu.id === item.menu)?.recipe[rule.inventoryId] ?? 0) * item.qty, 0);
              return qty ? [{ id: makeId(), name: rule.name, inventoryId: rule.inventoryId, qty, amount: qty * rule.amountPerItem, date: localDate() }] : [];
            }),
              ...getOrderItems(order).flatMap((item) => {
               if (!isConsignmentKey(item.menu)) return [];
                const consignment = s.consignments.find((entry) => entry.id === consignmentIdFromKey(item.menu));
                const unitCost = item.consignmentUnitCost ?? (consignment && consignment.packSize > 0 ? consignment.cost / consignment.packSize : undefined);
                if (unitCost === undefined) return [];
               return [{
                 id: makeId(),
                  name: `Bayar penitip · ${item.displayName ?? consignment?.name ?? 'Titipan'}`,
                 inventoryId: '',
                  consignmentId: consignment?.id,
                 qty: item.qty,
                  amount: item.qty * unitCost,
                 date: localDate(),
               }];
             }),
          ],
        } : s;
      }),
     cancelOrder: id => setState(s => {
       const order = s.activeOrders.find((entry) => entry.id === id);
       const nextState = cancelActiveOrder(s, id);
       if (nextState === s || !order) return s;
       return {
         ...nextState,
         auditTrail: [
           ...(s.auditTrail ?? []),
           {
             id: makeId(),
             action: 'order_cancelled',
             entityId: id,
             description: `Pesanan ${order.tables.length ? order.tables.map((table) => `M${table}`).join(' + ') : 'tanpa meja'} dibatalkan sebelum pembayaran.`,
             date: new Date().toISOString(),
           },
         ],
       };
     }),
     refundSale: (id, reason) => setState(s => {
       const sale = s.sales.find((entry) => entry.id === id);
       if (!sale || sale.status === 'refunded' || !reason.trim()) return s;
       const refundedAt = new Date().toISOString();
       return {
         ...s,
         sales: s.sales.map((entry) => entry.id === id ? { ...entry, status: 'refunded', refundedAt, refundReason: reason.trim() } : entry),
         auditTrail: [
           ...(s.auditTrail ?? []),
           {
             id: makeId(),
             action: 'sale_refunded',
             entityId: id,
             description: `Refund ${sale.receiptNumber ?? id}: ${reason.trim()}`,
             date: refundedAt,
             amount: sale.amount,
           },
         ],
       };
     }),
    consumeItems: items => setState(s => ({ ...s, inventory: consume(s.inventory, s.menus, items) })),
    restoreItems: items => setState(s => ({ ...s, inventory: restore(s.inventory, s.menus, items) })),
    addStock: (id, qty, reason = 'Penambahan manual') => setState(s => {
      const item = s.inventory.find((entry) => entry.id === id);
      if (!item || qty <= 0) return s;
      return {
        ...s,
        inventory: s.inventory.map(i => i.id === id ? { ...i, qty: i.qty + qty } : i),
        stockMovements: [...(s.stockMovements ?? []), { id: makeId(), inventoryId: id, quantity: qty, unit: item.unit, reason, date: localDate() }],
      };
    }),
    removeStock: (id, qty) => setState(s => ({ ...s, inventory: s.inventory.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty - qty) } : i) })),
      addExpense: (title, amount) => setState(s => ({ ...s, expenses: [...s.expenses, { id: makeId(), title, amount, date: localDate() }] })),
      closeCash: (openingCash, cashExpenses, countedCash, saleIds, notes) => setState(s => {
        const includedSales = s.sales.filter((sale) => saleIds.includes(sale.id));
        const cashSales = includedSales
          .filter((sale) => sale.method === 'Tunai')
          .reduce((sum, sale) => sum + sale.amount, 0);
        const qrisSales = includedSales
          .filter((sale) => sale.method === 'QRIS')
          .reduce((sum, sale) => sum + sale.amount, 0);
        const expectedCash = openingCash + cashSales - cashExpenses;
        return {
          ...s,
          cashClosures: [
            ...s.cashClosures,
            {
              id: makeId(),
              date: localDate(),
              closedAt: new Date().toISOString(),
              openingCash,
              cashSales,
              qrisSales,
              cashExpenses,
              expectedCash,
              countedCash,
              difference: countedCash - expectedCash,
              saleIds: includedSales.map((sale) => sale.id),
              notes: notes?.trim() || undefined,
            },
          ],
        };
      }),
      addShoppingExpense: (shoppingItemId, title, amount) => setState(s => addShoppingExpenseToState(
        s,
        shoppingItemId,
        title,
        amount,
        makeId,
        localDate(),
      )),
     addSavingsRule: (name, inventoryId, amountPerItem) => setState(s => {
       if (s.savingsRules.some((rule) => rule.inventoryId === inventoryId)) return s;
       return { ...s, savingsRules: [...s.savingsRules, { id: makeId(), name, inventoryId, amountPerItem, savedAmount: 0, savedQty: 0 }] };
     }),
      addManualSaving: (name, amount) => setState(s => ({
        ...s,
        savingsEntries: [...s.savingsEntries, { id: makeId(), name, inventoryId: '', qty: 0, amount, date: localDate() }],
      })),
       useSavings: (sourceId, sourceType, amount) => setState(s => {
         if (!Number.isFinite(amount) || amount <= 0) return s;
         if (sourceType === 'rule') {
           const rule = s.savingsRules.find((entry) => entry.id === sourceId);
           if (!rule || rule.savedAmount < amount) return s;
           return {
             ...s,
             savingsRules: s.savingsRules.map((entry) => entry.id === sourceId
               ? { ...entry, savedAmount: Math.max(0, entry.savedAmount - amount), savedQty: Math.max(0, entry.savedQty - amount / entry.amountPerItem) }
               : entry),
             expenses: [...s.expenses, { id: makeId(), title: `Belanja dari sisihan · ${rule.name}`, amount, date: localDate() }],
           };
         }
         const matchingEntries = s.savingsEntries.filter((entry) => sourceType === 'manual'
           ? entry.name === sourceId && !entry.inventoryId && !entry.consignmentId
           : entry.consignmentId === sourceId);
         const available = matchingEntries.reduce((sum, entry) => sum + entry.amount, 0);
         if (!matchingEntries.length || available < amount) return s;
         let remaining = amount;
         const savingsEntries = s.savingsEntries.map((entry) => {
           const matches = sourceType === 'manual'
             ? entry.name === sourceId && !entry.inventoryId && !entry.consignmentId
             : entry.consignmentId === sourceId;
           if (!matches || remaining <= 0) return entry;
           const used = Math.min(entry.amount, remaining);
           remaining -= used;
           return { ...entry, amount: entry.amount - used };
         }).filter((entry) => entry.amount > 0);
         const displayName = matchingEntries[0].name;
         return {
           ...s,
           savingsEntries,
           expenses: [...s.expenses, { id: makeId(), title: `Belanja dari sisihan · ${displayName}`, amount, date: localDate() }],
         };
       }),
     deleteSavingsRule: id => setState(s => ({ ...s, savingsRules: s.savingsRules.filter((rule) => rule.id !== id) })),
    setQrisImageUri: qrisImageUri => setState(s => ({ ...s, qrisImageUri })),
  }), [hydrated, state, storageKey]);
  return <WarungContext.Provider value={value}>{children}</WarungContext.Provider>;
}
function consume(items: InventoryItem[], menus: MenuItem[], orders: OrderItem[]) {
  const used: Record<string, number> = {};
  orders.forEach(o => Object.entries(o.recipe ?? menus.find(item => item.id === o.menu)?.recipe ?? {}).forEach(([id, qty]) => { used[id] = (used[id] || 0) + qty * o.qty; }));
  return items.map(item => ({ ...item, qty: Math.max(0, item.qty - (used[item.id] || 0)) }));
}
function restore(items: InventoryItem[], menus: MenuItem[], orders: OrderItem[]) {
  const used: Record<string, number> = {};
  orders.forEach(o => Object.entries(o.recipe ?? menus.find(item => item.id === o.menu)?.recipe ?? {}).forEach(([id, qty]) => { used[id] = (used[id] || 0) + qty * o.qty; }));
  return items.map(item => ({ ...item, qty: item.qty + (used[item.id] || 0) }));
}
export function useWarung() { const context = useContext(WarungContext); if (!context) throw new Error('useWarung harus dipakai di dalam WarungProvider'); return context; }
export const consignmentKey = (id: string) => `consignment:${id}`;
export const isConsignmentKey = (key: string) => key.startsWith('consignment:');
export const consignmentIdFromKey = (key: string) => key.replace(/^consignment:/, '');
export function getOrderItems(order: ActiveOrder) {
  return mergeOrderItems(order.items, order.pendingItems || []);
}
function restoreConsignmentStock(items: ConsignmentItem[], orders: OrderItem[]) {
  const restored: Record<string, number> = {};
  orders.forEach(order => {
    if (!isConsignmentKey(order.menu)) return;
    const id = consignmentIdFromKey(order.menu);
    restored[id] = (restored[id] || 0) + order.qty;
  });
  return items.map(item => restored[item.id] ? { ...item, qty: item.qty + restored[item.id] } : item);
}
export function orderTotal(order: ActiveOrder, menus: MenuItem[], consignments: ConsignmentItem[] = []) {
  return getOrderItems(order).reduce((sum, item) => sum + orderItemPrice(item, menus, consignments) * item.qty, 0);
}
export function menuVariantPrice(menu: MenuItem | undefined, variantId?: string) {
  const variant = menu?.variants?.find((entry) => entry.id === variantId);
  return (menu?.price ?? 0) + (variant?.priceDelta ?? 0);
}
export function orderItemPrice(item: OrderItem, menus: MenuItem[], consignments: ConsignmentItem[] = []) {
  const menu = menus.find((entry) => entry.id === item.menu);
  const consignmentPrice = isConsignmentKey(item.menu)
    ? consignments.find((consignment) => consignment.id === consignmentIdFromKey(item.menu))?.sellPrice
    : undefined;
  return item.unitPrice ?? (isConsignmentKey(item.menu) ? consignmentPrice ?? 0 : menuVariantPrice(menu, item.variantId));
}
function mergeOrderItems(...groups: OrderItem[][]) {
  return groups.flat().reduce<OrderItem[]>((items, item) => {
    const existingIndex = items.findIndex((entry) => entry.menu === item.menu
      && entry.displayName === item.displayName
      && entry.variantId === item.variantId
      && entry.unitPrice === item.unitPrice
      && entry.consignmentUnitCost === item.consignmentUnitCost
      && JSON.stringify(entry.recipe ?? null) === JSON.stringify(item.recipe ?? null));
    if (existingIndex >= 0) {
      items[existingIndex] = { ...items[existingIndex], qty: items[existingIndex].qty + item.qty };
    } else {
      items.push({ ...item });
    }
    return items;
  }, []);
}
function snapshotOrderItems(items: OrderItem[], menus: MenuItem[], consignments: ConsignmentItem[]) {
  return items.map((item) => {
    if (isConsignmentKey(item.menu)) {
      const consignment = consignments.find((entry) => entry.id === consignmentIdFromKey(item.menu));
      return {
        ...item,
        displayName: item.displayName ?? consignment?.name,
        unitPrice: item.unitPrice ?? consignment?.sellPrice,
        consignmentUnitCost: item.consignmentUnitCost ?? (consignment && consignment.packSize > 0 ? consignment.cost / consignment.packSize : undefined),
      };
    }
    const menu = menus.find((entry) => entry.id === item.menu);
     const variant = menu?.variants?.find((entry) => entry.id === item.variantId);
     return {
       ...item,
       displayName: item.displayName ?? [menu?.name, variant?.name].filter(Boolean).join(' · '),
       variantName: item.variantName ?? variant?.name,
       unitPrice: item.unitPrice ?? menuVariantPrice(menu, item.variantId),
       recipe: item.recipe ?? menu?.recipe,
     };
  });
}
function hasStockForOrder(inventory: InventoryItem[], consignments: ConsignmentItem[], items: OrderItem[]) {
  const ingredients: Record<string, number> = {};
  const consignmentQty: Record<string, number> = {};
  items.forEach((item) => {
    if (isConsignmentKey(item.menu)) {
      const id = consignmentIdFromKey(item.menu);
      consignmentQty[id] = (consignmentQty[id] || 0) + item.qty;
    } else {
      Object.entries(item.recipe ?? {}).forEach(([id, qty]) => { ingredients[id] = (ingredients[id] || 0) + qty * item.qty; });
    }
  });
  return Object.entries(ingredients).every(([id, qty]) => (inventory.find((item) => item.id === id)?.qty ?? 0) >= qty)
    && Object.entries(consignmentQty).every(([id, qty]) => (consignments.find((item) => item.id === id)?.qty ?? 0) >= qty);
}
function consumeConsignmentStock(items: ConsignmentItem[], orders: OrderItem[]) {
  const used: Record<string, number> = {};
  orders.forEach((order) => {
    if (!isConsignmentKey(order.menu)) return;
    const id = consignmentIdFromKey(order.menu);
    used[id] = (used[id] || 0) + order.qty;
  });
  return items.map((item) => used[item.id] ? { ...item, qty: Math.max(0, item.qty - used[item.id]) } : item);
}
export function formatRp(value: number) { return `Rp ${value.toLocaleString('id-ID')}`; }