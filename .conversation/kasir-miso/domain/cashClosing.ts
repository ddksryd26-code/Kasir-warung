import type { CashClosure, Sale } from '@/context/WarungContext';

export function isActiveSale(sale: Sale) {
  return sale.status !== 'refunded';
}

export function getPendingSales(sales: Sale[], closures: CashClosure[]) {
  const closedSaleIds = new Set(closures.flatMap((closure) => closure.saleIds));
  return sales.filter((sale) => isActiveSale(sale) && !closedSaleIds.has(sale.id));
}

export function summarizeCashClosing(
  sales: Sale[],
  openingCash: number,
  cashExpenses: number,
  countedCash: number,
) {
  const activeSales = sales.filter(isActiveSale);
  const cashSales = activeSales
    .filter((sale) => sale.method === 'Tunai')
    .reduce((sum, sale) => sum + sale.amount, 0);
  const qrisSales = activeSales
    .filter((sale) => sale.method === 'QRIS')
    .reduce((sum, sale) => sum + sale.amount, 0);
  const expectedCash = openingCash + cashSales - cashExpenses;
  return {
    cashSales,
    qrisSales,
    expectedCash,
    difference: countedCash - expectedCash,
  };
}