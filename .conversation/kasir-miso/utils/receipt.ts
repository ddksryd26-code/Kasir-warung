import { formatRp, type OrderItem } from '@/context/WarungContext';

export type ReceiptCatalogItem = { id: string; name: string; price: number };

export type ReceiptDocument = {
  receiptNumber?: string;
  items: OrderItem[];
  total?: number;
  amount?: number;
  method: 'Tunai' | 'QRIS';
  received?: number;
  change?: number;
  paidAt?: string;
  tables?: number[];
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getItemDetails(item: OrderItem, catalogItems: ReceiptCatalogItem[]) {
  const catalogItem = catalogItems.find((entry) => entry.id === item.menu);
  return {
    name: item.displayName ?? catalogItem?.name ?? 'Item dihapus',
    unitPrice: item.unitPrice ?? catalogItem?.price ?? 0,
  };
}

export function buildReceiptText(receipt: ReceiptDocument, catalogItems: ReceiptCatalogItem[]) {
  const total = receipt.total ?? receipt.amount ?? 0;
  return [
    'KASIR MISO',
    'Bukti pembayaran',
    receipt.receiptNumber ? `Nomor transaksi: ${receipt.receiptNumber}` : '',
    receipt.paidAt ? `Waktu: ${receipt.paidAt}` : '',
    receipt.tables?.length ? `Meja: ${receipt.tables.map((table) => `M${table}`).join(' + ')}` : '',
    '',
    ...receipt.items.map((item) => {
      const details = getItemDetails(item, catalogItems);
      return `${item.qty}x ${details.name} — ${formatRp(details.unitPrice * item.qty)}`;
    }),
    '',
    `TOTAL: ${formatRp(total)}`,
    `Metode: ${receipt.method}`,
    receipt.method === 'Tunai' && receipt.received !== undefined ? `Diterima: ${formatRp(receipt.received)}` : '',
    receipt.method === 'Tunai' && receipt.change !== undefined ? `Kembalian: ${formatRp(receipt.change)}` : '',
    '',
    'Terima kasih sudah berbelanja.',
  ].filter(Boolean).join('\n');
}

export function buildReceiptHtml(receipt: ReceiptDocument, catalogItems: ReceiptCatalogItem[]) {
  const total = receipt.total ?? receipt.amount ?? 0;
  const rows = receipt.items.map((item) => {
    const details = getItemDetails(item, catalogItems);
    return `<div class="row"><span>${item.qty}x ${escapeHtml(details.name)}</span><span>${formatRp(details.unitPrice * item.qty)}</span></div>`;
  }).join('');
  const table = receipt.tables?.length
    ? `<div>Meja: ${receipt.tables.map((tableNumber) => `M${tableNumber}`).join(' + ')}</div>`
    : '';
  const cashDetails = receipt.method === 'Tunai'
    ? `${receipt.received !== undefined ? `<div>Diterima: ${formatRp(receipt.received)}</div>` : ''}${receipt.change !== undefined ? `<div>Kembalian: ${formatRp(receipt.change)}</div>` : ''}`
    : '';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><style>
    @page { margin: 5mm; } * { box-sizing: border-box; } body { width: 58mm; margin: 0 auto; color: #111827; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.45; }
    h1 { font-size: 18px; text-align: center; margin: 0 0 2px; } .center { text-align: center; } .muted { color: #6b7280; font-size: 10px; }
    .rule { border-top: 1px dashed #9ca3af; margin: 10px 0; } .row { display: flex; justify-content: space-between; gap: 8px; margin: 4px 0; }
    .row span:first-child { flex: 1; } .row span:last-child { text-align: right; white-space: nowrap; } .total { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; margin-top: 8px; }
    .footer { margin-top: 14px; text-align: center; font-size: 10px; }
  </style></head><body>
    <h1>KASIR MISO</h1><div class="center muted">Bukti pembayaran</div><div class="rule"></div>
    ${receipt.receiptNumber ? `<div>No. transaksi: ${escapeHtml(receipt.receiptNumber)}</div>` : ''}${receipt.paidAt ? `<div>${escapeHtml(receipt.paidAt)}</div>` : ''}${table}
    <div class="rule"></div>${rows}<div class="rule"></div>
    <div class="total"><span>TOTAL</span><span>${formatRp(total)}</span></div>
    <div>Metode: ${receipt.method}</div>${cashDetails}<div class="footer">Terima kasih sudah berbelanja.</div>
  </body></html>`;
}