import { describe, expect, it } from 'vitest';
import type { ConsignmentItem, Expense, InventoryItem, MenuItem, Sale } from '@/context/WarungContext';
import { calculateReportMetrics } from './reporting';

const menus: MenuItem[] = [{
  id: 'miso',
  name: 'Miso',
  price: 20_000,
  recipe: { noodles: 2, egg: 1 },
}];
const inventory: InventoryItem[] = [
  { id: 'noodles', name: 'Mie', unit: 'pcs', qty: 20, safe: 2, cost: 2_000 },
  { id: 'egg', name: 'Telur', unit: 'pcs', qty: 20, safe: 2, cost: 3_000 },
];
const consignments: ConsignmentItem[] = [{
  id: 'cracker',
  name: 'Kerupuk',
  cost: 10_000,
  sellPrice: 2_000,
  packSize: 10,
  qty: 20,
}];

function sale(items: Sale['items'], amount: number, status: Sale['status'] = 'completed'): Sale {
  return { id: `sale-${amount}-${status}`, amount, method: 'Tunai', items, date: '2026-09-15', status };
}

describe('report profit calculations', () => {
  it('calculates menu HPP from the recipe and sold quantity', () => {
    const metrics = calculateReportMetrics(
      [sale([{ menu: 'miso', qty: 2, recipe: menus[0].recipe }], 40_000)],
      menus,
      inventory,
      [],
      [],
    );

    expect(metrics).toMatchObject({
      revenue: 40_000,
      ingredientCost: 14_000,
      consignmentCost: 0,
      grossProfit: 26_000,
      netProfit: 26_000,
    });
  });

  it('uses the consignor cost per piece and subtracts expenses after HPP', () => {
    const expenses: Expense[] = [{ id: 'expense-1', title: 'Gas', amount: 5_000, date: '2026-09-15' }];
    const metrics = calculateReportMetrics(
      [sale([{ menu: 'consignment:cracker', qty: 3, consignmentUnitCost: 1_000 }], 6_000)],
      [],
      [],
      consignments,
      expenses,
    );

    expect(metrics).toMatchObject({
      revenue: 6_000,
      consignmentCost: 3_000,
      totalCostOfGoods: 3_000,
      grossProfit: 3_000,
      expenses: 5_000,
      netProfit: -2_000,
    });
  });

  it('does not include refunded sales in revenue or either HPP category', () => {
    const metrics = calculateReportMetrics(
      [
        sale([{ menu: 'miso', qty: 1, recipe: menus[0].recipe }], 20_000),
        sale([{ menu: 'consignment:cracker', qty: 2, consignmentUnitCost: 1_000 }], 4_000, 'refunded'),
      ],
      menus,
      inventory,
      consignments,
      [],
    );

    expect(metrics).toMatchObject({
      revenue: 20_000,
      ingredientCost: 7_000,
      consignmentCost: 0,
      grossProfit: 13_000,
    });
  });
});