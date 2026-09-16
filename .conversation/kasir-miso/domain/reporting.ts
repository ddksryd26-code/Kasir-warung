import type { ConsignmentItem, Expense, InventoryItem, MenuItem, OrderItem, Sale } from '@/context/WarungContext';

export interface ReportMetrics {
  revenue: number;
  ingredientCost: number;
  consignmentCost: number;
  totalCostOfGoods: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  missingIngredientIds: string[];
  missingConsignmentIds: string[];
}

function isConsignmentKey(key: string) {
  return key.startsWith('consignment:');
}

function consignmentIdFromKey(key: string) {
  return key.replace(/^consignment:/, '');
}

export function isActiveSale(sale: Sale) {
  return sale.status !== 'refunded';
}

function itemRecipe(item: OrderItem, menus: MenuItem[]) {
  return item.recipe ?? menus.find((menu) => menu.id === item.menu)?.recipe ?? {};
}

function itemConsignmentCost(item: OrderItem, consignments: ConsignmentItem[]) {
  if (!isConsignmentKey(item.menu)) return undefined;
  if (typeof item.consignmentUnitCost === 'number') return item.consignmentUnitCost;
  const consignment = consignments.find((entry) => entry.id === consignmentIdFromKey(item.menu));
  return consignment && consignment.packSize > 0 ? consignment.cost / consignment.packSize : undefined;
}

export function calculateReportMetrics(
  sales: Sale[],
  menus: MenuItem[],
  inventory: InventoryItem[],
  consignments: ConsignmentItem[],
  expenses: Expense[],
): ReportMetrics {
  let revenue = 0;
  let ingredientCost = 0;
  let consignmentCost = 0;
  const missingIngredientIds = new Set<string>();
  const missingConsignmentIds = new Set<string>();

  sales.filter(isActiveSale).forEach((sale) => {
    revenue += sale.amount;
    sale.items.forEach((item) => {
      const cost = itemConsignmentCost(item, consignments);
      if (isConsignmentKey(item.menu)) {
        const id = consignmentIdFromKey(item.menu);
        if (typeof cost !== 'number') missingConsignmentIds.add(id);
        else consignmentCost += cost * item.qty;
        return;
      }

      Object.entries(itemRecipe(item, menus)).forEach(([inventoryId, quantity]) => {
        const inventoryItem = inventory.find((entry) => entry.id === inventoryId);
        if (typeof inventoryItem?.cost !== 'number' || !Number.isFinite(inventoryItem.cost)) {
          missingIngredientIds.add(inventoryId);
          return;
        }
        ingredientCost += inventoryItem.cost * quantity * item.qty;
      });
    });
  });

  const totalCostOfGoods = ingredientCost + consignmentCost;
  const grossProfit = revenue - totalCostOfGoods;
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  return {
    revenue,
    ingredientCost,
    consignmentCost,
    totalCostOfGoods,
    grossProfit,
    expenses: totalExpenses,
    netProfit: grossProfit - totalExpenses,
    missingIngredientIds: [...missingIngredientIds],
    missingConsignmentIds: [...missingConsignmentIds],
  };
}