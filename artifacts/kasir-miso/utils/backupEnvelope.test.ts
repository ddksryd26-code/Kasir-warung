import { describe, expect, it } from 'vitest';

import { createOfflineBackup, parseOfflineBackup } from './backupEnvelope';
import { hydrateWarungState } from '@/domain/menuOrdering';

describe('backup envelope', () => {
  it('creates and validates a portable offline backup file', () => {
    const backup = createOfflineBackup({
      menus: [],
      expenses: [{ id: 'expense-1', title: 'Gas', amount: 10_000, date: '2026-09-10' }],
      qrisImageUri: null,
    });

    expect(parseOfflineBackup(JSON.stringify(backup))).toEqual(backup);
  });

  it('keeps transactions, QRIS, and legacy expenses through offline restore', async () => {
    const sale = {
      id: 'sale-1',
      amount: 25_000,
      method: 'QRIS' as const,
      items: [{ menu: 'mie', qty: 2 }],
      date: '2026-09-10',
    };
    const legacyExpense = {
      id: 'expense-legacy',
      title: 'Belanja lama',
      amount: 10_000,
      date: '2026-09-09',
    };
    const backup = createOfflineBackup({
      menus: [],
      activeOrders: [],
      kitchenOrders: [],
      inventory: [],
      consignments: [],
      expenses: [legacyExpense],
      sales: [sale],
      savingsRules: [],
      savingsEntries: [],
      qrisImageUri: 'data:image/png;base64,stored-qris',
    });
    const parsed = parseOfflineBackup(JSON.stringify(backup));
    const restoredState = await hydrateWarungState(
      JSON.stringify(parsed.data),
      async (uri) => uri,
    );

    expect(restoredState.sales).toEqual([sale]);
    expect(restoredState.expenses).toEqual([legacyExpense]);
    expect(restoredState.qrisImageUri).toBe('data:image/png;base64,stored-qris');
  });

  it('rejects an invalid offline file before it can be restored', () => {
    expect(() => parseOfflineBackup('{not-json')).toThrow('bukan JSON yang valid');
    expect(() => parseOfflineBackup(JSON.stringify({
      format: 'kasir-miso-backup',
      version: 1,
      target: 'offline',
      createdAt: '2026-09-10T10:00:00.000Z',
      data: { inventory: 'not-an-array' },
    }))).toThrow('bagian inventory tidak valid');
    expect(() => parseOfflineBackup(JSON.stringify({
      format: 'kasir-miso-backup',
      version: 1,
      target: 'offline',
      createdAt: '2026-09-10T10:00:00.000Z',
      data: { qrisImageUri: 123 },
    }))).toThrow('Data QRIS');
  });

  it('keeps shopping note identity and purchase state in the offline backup payload', () => {
    const notes = {
      shoppingToday: [{
        id: 'shopping-1',
        text: 'Minyak',
        done: true,
        createdAt: '2026-09-09T08:00:00.000Z',
        quantity: 2,
        unit: 'liter',
        price: 25_000,
        expenseRecorded: true,
      }],
      shoppingTomorrow: [],
      carry: [],
      general: [],
      shoppingTomorrowDate: '2026-09-10',
    };
    const backup = createOfflineBackup({
      notes: JSON.stringify(notes),
    });

    expect(JSON.parse(String(backup.data.notes))).toEqual(notes);
  });
});