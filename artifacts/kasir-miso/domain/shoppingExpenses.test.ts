import { describe, expect, it } from 'vitest';
import type { WarungState } from '@/context/WarungContext';
import { addShoppingExpense, normalizeShoppingExpenses } from './shoppingExpenses';

function state(expenses: WarungState['expenses'] = []): WarungState {
  return {
    menus: [],
    activeOrders: [],
    kitchenOrders: [],
    inventory: [],
    consignments: [],
    expenses,
    sales: [],
    cashClosures: [],
    savingsRules: [],
    savingsEntries: [],
  };
}

describe('shopping expense recording', () => {
  it('preserves automatic expense links while accepting legacy expenses without one', () => {
    const legacyExpense = {
      id: 'expense-legacy',
      title: 'Belanja lama',
      amount: 10_000,
      date: '2026-09-08',
    };
    const linkedExpense = {
      id: 'expense-linked',
      title: 'Belanja baru',
      amount: 25_000,
      date: '2026-09-09',
      shoppingItemId: 'shopping-1',
    };

    expect(normalizeShoppingExpenses([legacyExpense, linkedExpense])).toEqual([
      legacyExpense,
      linkedExpense,
    ]);
  });

  it('records a priced shopping item once even when the action is repeated', () => {
    const first = addShoppingExpense(
      state(),
      'shopping-1',
      'Belanja hari ini · Minyak',
      25_000,
      () => 'expense-1',
      '2026-09-09',
    );
    const repeated = addShoppingExpense(
      first,
      'shopping-1',
      'Belanja hari ini · Minyak',
      25_000,
      () => 'expense-2',
      '2026-09-09',
    );

    expect(first.expenses).toHaveLength(1);
    expect(repeated.expenses).toEqual(first.expenses);
  });

  it('does not create an expense for an invalid price', () => {
    expect(addShoppingExpense(
      state(),
      'shopping-1',
      'Belanja hari ini · Minyak',
      0,
      () => 'expense-1',
      '2026-09-09',
    )).toEqual(state());
  });

  it('keeps an existing expense when the shopping item is toggled again', () => {
    const existing = [{
      id: 'expense-1',
      title: 'Belanja hari ini · Minyak',
      amount: 25_000,
      date: '2026-09-09',
      shoppingItemId: 'shopping-1',
    }];

    expect(addShoppingExpense(
      state(existing),
      'shopping-1',
      'Belanja hari ini · Minyak',
      30_000,
      () => 'expense-2',
      '2026-09-09',
    ).expenses).toEqual(existing);
  });
});