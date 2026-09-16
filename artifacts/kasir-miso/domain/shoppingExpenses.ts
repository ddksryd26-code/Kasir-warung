import type { Expense, WarungState } from '@/context/WarungContext';

type IdFactory = () => string;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Keep old expense records usable while preserving the shopping item
 * relationship introduced for automatic shopping expenses.
 */
export function normalizeShoppingExpenses(value: unknown): Expense[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!isObjectRecord(entry)) return [];

    const expense = { ...entry } as unknown as Expense;
    if (typeof entry.shoppingItemId !== 'string' || !entry.shoppingItemId.trim()) {
      delete expense.shoppingItemId;
    }
    return [expense];
  });
}

export function addShoppingExpense(
  state: WarungState,
  shoppingItemId: string,
  title: string,
  amount: number,
  makeId: IdFactory,
  date: string,
): WarungState {
  if (!shoppingItemId || !title.trim() || !Number.isFinite(amount) || amount <= 0) return state;
  if (state.expenses.some((expense) => expense.shoppingItemId === shoppingItemId)) return state;

  return {
    ...state,
    expenses: [
      ...state.expenses,
      { id: makeId(), title: title.trim(), amount, date, shoppingItemId },
    ],
  };
}