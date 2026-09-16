import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export const NOTES_STORAGE_KEY = 'kasir-miso-notes-v1';

export type NoteCategory = 'shopping' | 'carry' | 'general';
export type ShoppingDay = 'today' | 'tomorrow';

export interface NoteItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  quantity?: number;
  unit?: string;
  price?: number;
  expenseRecorded?: boolean;
}

interface NotesState {
  shoppingToday: NoteItem[];
  shoppingTomorrow: NoteItem[];
  carry: NoteItem[];
  general: NoteItem[];
}

interface NotesContextValue {
  notes: NotesState;
  hydrated: boolean;
  addNote: (category: NoteCategory, text: string) => void;
  addShoppingItem: (day: ShoppingDay, name: string, quantity: number, unit: string) => void;
  toggleNote: (category: NoteCategory, id: string) => void;
  toggleShoppingItem: (day: ShoppingDay, id: string) => void;
  deleteNote: (category: NoteCategory, id: string) => void;
  deleteShoppingItem: (day: ShoppingDay, id: string) => void;
  setShoppingPrice: (day: ShoppingDay, id: string, price: number) => void;
  markShoppingExpenseRecorded: (day: ShoppingDay, id: string) => void;
  changeShoppingQuantity: (day: ShoppingDay, id: string, delta: number) => void;
  clearShoppingCompleted: (day: ShoppingDay) => void;
  clearCompleted: (category: NoteCategory) => void;
}

const createEmptyNotes = (): NotesState => ({ shoppingToday: [], shoppingTomorrow: [], carry: [], general: [] });
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const tomorrowDateKey = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return dateKey(date);
};
const listForDay = (state: NotesState, day: ShoppingDay) => day === 'today' ? state.shoppingToday : state.shoppingTomorrow;
const replaceListForDay = (state: NotesState, day: ShoppingDay, items: NoteItem[]): NotesState => ({
  ...state,
  [day === 'today' ? 'shoppingToday' : 'shoppingTomorrow']: items,
});
const listForCategory = (state: NotesState, category: NoteCategory) => category === 'carry' ? state.carry : state.general;
const replaceListForCategory = (state: NotesState, category: NoteCategory, items: NoteItem[]): NotesState => (
  category === 'carry' ? { ...state, carry: items } : { ...state, general: items }
);
export const rollShoppingItemsToToday = (
  shoppingToday: NoteItem[],
  shoppingTomorrow: NoteItem[],
  shouldRollOver: boolean,
) => shouldRollOver
  ? { shoppingToday: [...shoppingTomorrow, ...shoppingToday], shoppingTomorrow: [] }
  : { shoppingToday, shoppingTomorrow };
const normalizeShoppingItems = (items: unknown): NoteItem[] => (
  Array.isArray(items)
    ? items.map((item) => ({
      ...(item as NoteItem),
      quantity: typeof (item as NoteItem).quantity === 'number' && (item as NoteItem).quantity > 0 ? (item as NoteItem).quantity : 1,
      unit: typeof (item as NoteItem).unit === 'string' && (item as NoteItem).unit.trim() ? (item as NoteItem).unit : 'pcs',
      price: typeof (item as NoteItem).price === 'number' && (item as NoteItem).price > 0 ? item.price : undefined,
      expenseRecorded: Boolean((item as NoteItem).expenseRecorded),
    }))
    : []
);

const NotesContext = createContext<NotesContextValue | null>(null);

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<NotesState>(createEmptyNotes);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(NOTES_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<NotesState> & { shopping?: unknown; shoppingTomorrowDate?: string };
        if (!mounted) return;
        const legacyShopping = normalizeShoppingItems(parsed.shopping);
        const savedTomorrow = Array.isArray(parsed.shoppingTomorrow) ? normalizeShoppingItems(parsed.shoppingTomorrow) : legacyShopping;
        const savedToday = Array.isArray(parsed.shoppingToday) ? normalizeShoppingItems(parsed.shoppingToday) : [];
        const shouldRollOver = Boolean(parsed.shoppingTomorrowDate && parsed.shoppingTomorrowDate !== tomorrowDateKey());
        const rolledOver = rollShoppingItemsToToday(savedToday, savedTomorrow, shouldRollOver);
        setNotes({
          shoppingToday: rolledOver.shoppingToday,
          shoppingTomorrow: rolledOver.shoppingTomorrow,
          carry: Array.isArray(parsed.carry) ? parsed.carry : [],
          general: Array.isArray(parsed.general) ? parsed.general : [],
        });
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setHydrated(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (hydrated) void AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify({ ...notes, shoppingTomorrowDate: tomorrowDateKey() }));
  }, [hydrated, notes]);

  useEffect(() => {
    if (!hydrated) return;
    const rollover = () => {
      const expectedTomorrow = tomorrowDateKey();
      void AsyncStorage.getItem(NOTES_STORAGE_KEY).then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as { shoppingTomorrowDate?: string };
        if (parsed.shoppingTomorrowDate && parsed.shoppingTomorrowDate !== expectedTomorrow) {
          setNotes((current) => {
            const rolledOver = rollShoppingItemsToToday(current.shoppingToday, current.shoppingTomorrow, true);
            return { ...current, ...rolledOver };
          });
        }
      }).catch(() => undefined);
    };
    const timer = setInterval(rollover, 60_000);
    return () => clearInterval(timer);
  }, [hydrated]);

  const value = useMemo<NotesContextValue>(() => ({
    notes,
    hydrated,
    addNote: (category, text) => {
      const trimmed = text.trim();
      if (!trimmed || category === 'shopping') return;
      setNotes((current) => replaceListForCategory(current, category, [{ id: makeId(), text: trimmed, done: false, createdAt: new Date().toISOString() }, ...listForCategory(current, category)]));
    },
    addShoppingItem: (day, name, quantity, unit) => {
      const trimmedName = name.trim();
      const trimmedUnit = unit.trim() || 'pcs';
      const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? Math.round(quantity * 100) / 100 : 1;
      if (!trimmedName) return;
      setNotes((current) => {
        const shopping = listForDay(current, day);
        const duplicateIndex = shopping.findIndex((item) => !item.done && item.text.toLowerCase() === trimmedName.toLowerCase() && item.unit === trimmedUnit);
        if (duplicateIndex < 0) {
          return replaceListForDay(current, day, [{ id: makeId(), text: trimmedName, done: false, createdAt: new Date().toISOString(), quantity: safeQuantity, unit: trimmedUnit }, ...shopping]);
        }
        const updated = [...shopping];
        const duplicate = updated[duplicateIndex];
        updated[duplicateIndex] = { ...duplicate, quantity: (duplicate.quantity ?? 1) + safeQuantity };
        return replaceListForDay(current, day, updated);
      });
    },
    toggleNote: (category, id) => {
      if (category === 'shopping') return;
      setNotes((current) => replaceListForCategory(current, category, listForCategory(current, category).map((item) => item.id === id ? { ...item, done: !item.done } : item)));
    },
    toggleShoppingItem: (day, id) => {
      setNotes((current) => {
        const shopping = listForDay(current, day);
        const item = shopping.find((entry) => entry.id === id);
        if (day === 'today' && item && !item.done && (!item.price || item.price <= 0)) return current;
        return replaceListForDay(current, day, shopping.map((entry) => entry.id === id ? { ...entry, done: !entry.done } : entry));
      });
    },
    deleteNote: (category, id) => {
      if (category === 'shopping') return;
      setNotes((current) => replaceListForCategory(current, category, listForCategory(current, category).filter((item) => item.id !== id)));
    },
    deleteShoppingItem: (day, id) => {
      setNotes((current) => replaceListForDay(current, day, listForDay(current, day).filter((item) => item.id !== id)));
    },
    setShoppingPrice: (day, id, price) => {
      const safePrice = Number.isFinite(price) && price > 0 ? Math.round(price) : undefined;
      setNotes((current) => replaceListForDay(current, day, listForDay(current, day).map((item) => item.id === id ? { ...item, price: safePrice } : item)));
    },
    markShoppingExpenseRecorded: (day, id) => {
      setNotes((current) => replaceListForDay(current, day, listForDay(current, day).map((item) => item.id === id ? { ...item, expenseRecorded: true } : item)));
    },
    changeShoppingQuantity: (day, id, delta) => {
      setNotes((current) => replaceListForDay(current, day, listForDay(current, day).map((item) => item.id === id ? { ...item, quantity: Math.max(1, Math.round(((item.quantity ?? 1) + delta) * 100) / 100) } : item)));
    },
    clearShoppingCompleted: (day) => {
      setNotes((current) => replaceListForDay(current, day, listForDay(current, day).filter((item) => !item.done)));
    },
    clearCompleted: (category) => {
      if (category === 'shopping') return;
      setNotes((current) => replaceListForCategory(current, category, listForCategory(current, category).filter((item) => !item.done)));
    },
  }), [hydrated, notes]);

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const context = useContext(NotesContext);
  if (!context) throw new Error('useNotes harus dipakai di dalam NotesProvider');
  return context;
}