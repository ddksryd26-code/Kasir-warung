import { describe, expect, it } from 'vitest';
import type { CashClosure, Sale } from '@/context/WarungContext';
import { getPendingSales, summarizeCashClosing } from './cashClosing';

const sale = (id: string, method: Sale['method'], amount: number): Sale => ({
  id,
  amount,
  method,
  items: [],
  date: '2026-09-14',
});

describe('cash closing', () => {
  it('only includes sales that have not been reconciled', () => {
    const sales = [sale('closed', 'Tunai', 20_000), sale('pending', 'QRIS', 30_000)];
    const closures: CashClosure[] = [{
      id: 'closure-1',
      date: '2026-09-14',
      closedAt: '2026-09-14T10:00:00.000Z',
      openingCash: 0,
      cashSales: 20_000,
      qrisSales: 0,
      cashExpenses: 0,
      expectedCash: 20_000,
      countedCash: 20_000,
      difference: 0,
      saleIds: ['closed'],
    }];

    expect(getPendingSales(sales, closures).map((item) => item.id)).toEqual(['pending']);
  });

  it('calculates expected cash without counting QRIS sales', () => {
    const summary = summarizeCashClosing(
      [sale('cash', 'Tunai', 50_000), sale('qris', 'QRIS', 100_000)],
      100_000,
      10_000,
      145_000,
    );

    expect(summary).toEqual({
      cashSales: 50_000,
      qrisSales: 100_000,
      expectedCash: 140_000,
      difference: 5_000,
    });
  });

  it('excludes refunded sales from pending sales and cash totals', () => {
    const refunded = { ...sale('refunded', 'Tunai', 40_000), status: 'refunded' as const };
    const pending = sale('pending', 'Tunai', 25_000);

    expect(getPendingSales([refunded, pending], [])).toEqual([pending]);
    expect(summarizeCashClosing([refunded, pending], 10_000, 0, 35_000)).toEqual({
      cashSales: 25_000,
      qrisSales: 0,
      expectedCash: 35_000,
      difference: 0,
    });
  });
});