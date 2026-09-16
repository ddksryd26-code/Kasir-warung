import { describe, expect, it } from 'vitest';
import type { NoteItem } from './NotesContext';
import { rollShoppingItemsToToday } from './NotesContext';

const tomorrowItem: NoteItem = {
  id: 'shopping-tomorrow',
  text: 'Minyak',
  done: true,
  createdAt: '2026-09-08T10:00:00.000Z',
  quantity: 2,
  unit: 'liter',
  price: 42_000,
  expenseRecorded: true,
};

describe('shopping note rollover', () => {
  it('moves tomorrow items to today without losing price or expense status', () => {
    const todayItem: NoteItem = {
      id: 'shopping-today',
      text: 'Beras',
      done: false,
      createdAt: '2026-09-09T08:00:00.000Z',
      quantity: 1,
      unit: 'pack',
    };

    const rolledOver = rollShoppingItemsToToday([todayItem], [tomorrowItem], true);

    expect(rolledOver.shoppingTomorrow).toEqual([]);
    expect(rolledOver.shoppingToday).toEqual([tomorrowItem, todayItem]);
    expect(rolledOver.shoppingToday[0]).toMatchObject({
      price: 42_000,
      done: true,
      expenseRecorded: true,
    });
  });

  it('does not move or mutate lists when the next day has not arrived', () => {
    const today = [tomorrowItem];
    const tomorrow: NoteItem[] = [];

    expect(rollShoppingItemsToToday(today, tomorrow, false)).toEqual({
      shoppingToday: today,
      shoppingTomorrow: tomorrow,
    });
  });
});