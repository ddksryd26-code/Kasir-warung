import React, { useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { consignmentIdFromKey, consignmentKey, formatRp, isConsignmentKey, isDateInReportPeriod, ReportPeriod, type Sale, useWarung } from '@/context/WarungContext';
import { isActiveSale } from '@/domain/cashClosing';
import { useColors } from '@/hooks/useColors';
import { Badge, EmptyState, PageHeader, PrimaryButton, Screen, SectionHeader, Surface } from '@/components/WarungUI';
import { buildReceiptHtml, buildReceiptText } from '@/utils/receipt';

const periods: ReportPeriod[] = ['Hari ini', 'Minggu ini', 'Bulan ini'];

function formatHistoryDate(value: string) {
  const parts = value.split('-');
  return parts.length === 3 ? parts.reverse().join('/') : value;
}

export default function HistoryScreen() {
  const c = useColors();
  const { menus, consignments, sales, auditTrail = [], cashClosures, refundSale } = useWarung();
  const [period, setPeriod] = useState<ReportPeriod>('Hari ini');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [receiptAction, setReceiptAction] = useState<'print' | 'pdf' | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const filteredSales = sales
    .filter((sale) => isDateInReportPeriod(sale.date, period))
    .slice()
    .reverse();
  const total = filteredSales.filter(isActiveSale).reduce((sum, sale) => sum + sale.amount, 0);
  const catalogItems = [
    ...menus.map((menu) => ({ id: menu.id, name: menu.name, price: menu.price })),
    ...consignments.map((item) => ({ id: `consignment:${item.id}`, name: item.name, price: item.sellPrice })),
  ];
  const closeDetail = () => {
    setSelectedSale(null);
    setReceiptAction(null);
    setRefundOpen(false);
    setRefundReason('');
  };
  const openRefund = () => {
    if (!selectedSale) return;
    if (cashClosures.some((closure) => closure.saleIds.includes(selectedSale.id))) {
      Alert.alert('Refund tidak tersedia', 'Transaksi ini sudah masuk tutup kasir. Refund setelah penutupan perlu dicatat sebagai penyesuaian kas terlebih dahulu.');
      return;
    }
    setRefundReason('');
    setRefundOpen(true);
  };
  const confirmRefund = () => {
    if (!selectedSale || !refundReason.trim()) {
      Alert.alert('Alasan wajib diisi', 'Tuliskan alasan refund agar masuk ke audit trail.');
      return;
    }
    refundSale(selectedSale.id, refundReason);
    closeDetail();
    Alert.alert('Refund tersimpan', 'Transaksi tetap tersimpan di riwayat dan ditandai sebagai refund.');
  };
  const shareSelectedReceipt = async () => {
    if (!selectedSale) return;
    const message = buildReceiptText(selectedSale, catalogItems);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        Alert.alert('Struk disalin', 'Bukti pembayaran sudah disalin ke clipboard.');
        return;
      }
      await Share.share({ message, title: `Struk ${selectedSale.receiptNumber ?? ''}` });
    } catch {
      Alert.alert('Bagikan belum tersedia', 'Struk tidak dapat dibagikan dari perangkat ini.');
    }
  };
  const printSelectedReceipt = async () => {
    if (!selectedSale) return;
    setReceiptAction('print');
    try {
      if (Platform.OS === 'web') {
        window.print();
        return;
      }
      await Print.printAsync({ html: buildReceiptHtml(selectedSale, catalogItems) });
    } catch {
      Alert.alert('Cetak belum tersedia', 'Gunakan tombol bagikan untuk mengirim struk ke aplikasi lain.');
    } finally {
      setReceiptAction(null);
    }
  };
  const createSelectedPdf = async () => {
    if (!selectedSale) return;
    setReceiptAction('pdf');
    try {
      if (Platform.OS === 'web') {
        window.print();
        return;
      }
      const { uri } = await Print.printToFileAsync({ html: buildReceiptHtml(selectedSale, catalogItems) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Bagikan PDF struk' });
      } else {
        Alert.alert('PDF siap', 'Perangkat ini tidak menyediakan menu berbagi untuk file PDF.');
      }
    } catch {
      Alert.alert('PDF belum dibuat', 'Gunakan tombol bagikan untuk mengirim struk sebagai teks.');
    } finally {
      setReceiptAction(null);
    }
  };

  return (
    <Screen>
      <PageHeader
        eyebrow="Catatan penjualan"
        title="Riwayat transaksi"
        subtitle="Semua pembayaran yang sudah diterima tersimpan di sini."
        backRoute="/"
      />
      <View style={s.periods}>
        {periods.map((item) => (
          <Pressable
            key={item}
            onPress={() => setPeriod(item)}
            style={({ pressed }) => [
              s.period,
              {
                backgroundColor: period === item ? c.primary : c.card,
                borderColor: period === item ? c.primary : c.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[s.periodText, { color: period === item ? c.primaryForeground : c.mutedForeground }]}>
              {item}
            </Text>
          </Pressable>
        ))}
      </View>
      <Surface tone="ink" style={s.summary}>
        <View style={[s.summaryIcon, { backgroundColor: c.accent }]}>
          <Ionicons name="receipt-outline" size={21} color={c.accentForeground} />
        </View>
        <View style={s.flex}>
          <Text style={[s.summaryLabel, { color: c.mutedForeground }]}>TOTAL PENJUALAN · {period.toUpperCase()}</Text>
          <Text style={[s.summaryValue, { color: c.card }]}>{formatRp(total)}</Text>
        </View>
        <Badge tone="primary">{filteredSales.length} nota</Badge>
      </Surface>
      <SectionHeader title="Daftar transaksi" meta={filteredSales.length ? 'Terbaru' : undefined} icon="list-outline" />
      {!filteredSales.length ? (
        <EmptyState
          icon="receipt-outline"
          title="Belum ada transaksi"
          body={`Pembayaran pada periode ${period.toLowerCase()} akan muncul di sini.`}
        />
      ) : (
        filteredSales.map((sale) => (
          <Pressable key={sale.id} testID={`transaction-${sale.id}`} onPress={() => setSelectedSale(sale)} style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
          <Surface style={s.card}>
            <View style={s.cardTop}>
              <View style={s.dateWrap}>
                 <View style={[s.icon, { backgroundColor: sale.status === 'refunded' ? c.muted : c.secondary }]}>
                   <Ionicons name={sale.status === 'refunded' ? 'arrow-undo-circle-outline' : 'checkmark-circle-outline'} size={19} color={sale.status === 'refunded' ? c.destructive : c.primary} />
                </View>
                <View style={s.flex}>
                  <Text style={[s.date, { color: c.foreground }]}>{formatHistoryDate(sale.date)}</Text>
                  <Text style={[s.meta, { color: c.mutedForeground }]}>
                    {sale.receiptNumber ? `${sale.receiptNumber} · ` : ''}{sale.paidAt ? `Dibayar ${sale.paidAt}` : 'Pembayaran diterima'}
                  </Text>
                </View>
              </View>
               <Text style={[s.amount, { color: sale.status === 'refunded' ? c.mutedForeground : c.foreground, textDecorationLine: sale.status === 'refunded' ? 'line-through' : 'none' }]}>{formatRp(sale.amount)}</Text>
            </View>
            <View style={[s.divider, { backgroundColor: c.border }]} />
            <View style={s.detailRow}>
              <Text style={[s.items, { color: c.mutedForeground }]}>
                 {sale.items.map((item) => {
                    const name = item.displayName ?? (isConsignmentKey(item.menu)
                     ? consignments.find((consignment) => consignment.id === consignmentIdFromKey(item.menu))?.name
                      : menus.find((menu) => menu.id === item.menu)?.name);
                   return `${name || 'Item dihapus'} ×${item.qty}`;
                 }).join(' · ')}
              </Text>
               <View style={s.badgeRow}><Badge tone={sale.method === 'QRIS' ? 'accent' : 'muted'}>{sale.method}</Badge>{sale.status === 'refunded' ? <Badge tone="danger">Refund</Badge> : null}</View>
            </View>
            {sale.tables?.length ? (
              <Text style={[s.table, { color: c.mutedForeground }]}>
                <Ionicons name="grid-outline" size={12} /> {sale.tables.map((table) => `M${table}`).join(' + ')}
              </Text>
            ) : null}
          </Surface>
          </Pressable>
        ))
      )}
      <Modal visible={!!selectedSale} transparent animationType="slide" onRequestClose={closeDetail}>
        <View style={[s.backdrop, { backgroundColor: c.foreground + 'B8' }]}>
          <View style={[s.modal, { backgroundColor: c.card }]}>
            <View style={s.modalHeader}>
              <View>
                <Text style={[s.modalKicker, { color: c.primary }]}>DETAIL TRANSAKSI</Text>
                <Text style={[s.modalTitle, { color: c.foreground }]}>{selectedSale?.receiptNumber ?? 'Transaksi lama'}</Text>
              </View>
              <Pressable accessibilityLabel="Tutup detail transaksi" hitSlop={12} onPress={closeDetail}>
                <Ionicons name="close-circle" size={27} color={c.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView style={s.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={[s.modalMeta, { color: c.mutedForeground }]}>
                {selectedSale?.paidAt ? `Dibayar ${selectedSale.paidAt}` : selectedSale ? formatHistoryDate(selectedSale.date) : ''} · {selectedSale?.method}
              </Text>
              {selectedSale?.tables?.length ? (
                <Text style={[s.modalMeta, { color: c.mutedForeground }]}>Meja {selectedSale.tables.map((table) => `M${table}`).join(' + ')}</Text>
              ) : null}
              <View style={[s.modalItems, { borderColor: c.border }]}>
                {selectedSale?.items.map((item, index) => {
                  const name = item.displayName ?? (isConsignmentKey(item.menu)
                    ? consignments.find((consignment) => consignment.id === consignmentIdFromKey(item.menu))?.name
                    : menus.find((menu) => menu.id === item.menu)?.name) ?? 'Item dihapus';
                  const unitPrice = item.unitPrice ?? menus.find((menu) => menu.id === item.menu)?.price ?? consignments.find((consignment) => consignmentKey(consignment.id) === item.menu)?.sellPrice ?? 0;
                  return (
                    <View key={`${item.menu}-${index}`} style={s.modalItemRow}>
                      <View style={s.itemCopy}><Text style={[s.modalItemName, { color: c.foreground }]}>{item.qty}× {name}</Text><Text style={[s.modalItemMeta, { color: c.mutedForeground }]}>{formatRp(unitPrice)} / item</Text></View>
                      <Text style={[s.modalItemAmount, { color: c.foreground }]}>{formatRp(unitPrice * item.qty)}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={s.totalRow}><Text style={[s.totalLabel, { color: c.foreground }]}>Total</Text><Text style={[s.totalValue, { color: c.primary }]}>{selectedSale ? formatRp(selectedSale.amount) : ''}</Text></View>
              {selectedSale?.method === 'Tunai' && selectedSale.received !== undefined ? (
                <View style={s.cashRows}>
                  <View style={s.cashRow}><Text style={[s.modalMeta, { color: c.mutedForeground }]}>Uang diterima</Text><Text style={[s.modalMeta, { color: c.foreground }]}>{formatRp(selectedSale.received)}</Text></View>
                  <View style={s.cashRow}><Text style={[s.modalMeta, { color: c.mutedForeground }]}>Kembalian</Text><Text style={[s.modalMeta, { color: c.foreground }]}>{formatRp(selectedSale.change ?? 0)}</Text></View>
                </View>
              ) : null}
            </ScrollView>
            <View style={s.actionRow}>
              <Pressable testID="history-print-receipt" disabled={!!receiptAction} onPress={printSelectedReceipt} style={({ pressed }) => [s.actionButton, { borderColor: c.border, backgroundColor: c.secondary, opacity: receiptAction ? 0.55 : (pressed ? 0.7 : 1) }]}>
                <Ionicons name="print-outline" size={17} color={c.foreground} /><Text style={[s.actionText, { color: c.foreground }]}>{receiptAction === 'print' ? '...' : 'Cetak'}</Text>
              </Pressable>
              <Pressable testID="history-pdf-receipt" disabled={!!receiptAction} onPress={createSelectedPdf} style={({ pressed }) => [s.actionButton, { borderColor: c.border, backgroundColor: c.secondary, opacity: receiptAction ? 0.55 : (pressed ? 0.7 : 1) }]}>
                <Ionicons name="document-text-outline" size={17} color={c.foreground} /><Text style={[s.actionText, { color: c.foreground }]}>{receiptAction === 'pdf' ? '...' : 'PDF'}</Text>
              </Pressable>
            </View>
            <Pressable testID="history-share-receipt" onPress={shareSelectedReceipt} style={({ pressed }) => [s.shareButton, { borderColor: c.primary, opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons name="share-social-outline" size={17} color={c.primary} /><Text style={[s.actionText, { color: c.primary }]}>Bagikan struk</Text>
            </Pressable>
            {selectedSale?.status !== 'refunded' ? <Pressable testID="open-refund" onPress={openRefund} style={({ pressed }) => [s.refundButton, { borderColor: c.destructive, opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons name="arrow-undo-outline" size={17} color={c.destructive} /><Text style={[s.actionText, { color: c.destructive }]}>Refund transaksi</Text>
            </Pressable> : <Text style={[s.refundedNote, { color: c.destructive }]}>Transaksi ini sudah direfund.</Text>}
          </View>
        </View>
      </Modal>
      <Modal visible={refundOpen} transparent animationType="slide" onRequestClose={() => setRefundOpen(false)}>
        <View style={[s.backdrop, { backgroundColor: c.foreground + 'B8' }]}>
          <View style={[s.refundModal, { backgroundColor: c.card }]}>
            <View style={s.modalHeader}>
              <View><Text style={[s.modalKicker, { color: c.destructive }]}>AUDIT TRANSAKSI</Text><Text style={[s.modalTitle, { color: c.foreground }]}>Refund transaksi</Text></View>
              <Pressable accessibilityLabel="Tutup refund" hitSlop={12} onPress={() => setRefundOpen(false)}><Ionicons name="close-circle" size={27} color={c.mutedForeground} /></Pressable>
            </View>
            <Text style={[s.modalMeta, { color: c.mutedForeground }]}>Refund penuh sebesar {selectedSale ? formatRp(selectedSale.amount) : ''}. Transaksi asli tetap disimpan sebagai arsip.</Text>
            <Text style={[s.label, { color: c.mutedForeground }]}>Alasan refund</Text>
            <TextInput testID="refund-reason-input" autoFocus value={refundReason} onChangeText={setRefundReason} multiline placeholder="Contoh: Pesanan dibatalkan pelanggan" placeholderTextColor={c.mutedForeground} style={[s.refundInput, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
            <PrimaryButton testID="confirm-refund" onPress={confirmRefund} icon="arrow-undo-outline">Simpan refund</PrimaryButton>
          </View>
        </View>
      </Modal>
      <SectionHeader title="Audit aktivitas" meta={auditTrail.length ? `${auditTrail.length} catatan` : undefined} icon="shield-checkmark-outline" />
      {!auditTrail.length ? <EmptyState icon="shield-checkmark-outline" title="Belum ada aktivitas koreksi" body="Refund dan pembatalan order akan tercatat di sini." /> : auditTrail.slice().reverse().slice(0, 5).map((entry) => (
        <Surface key={entry.id} style={s.auditCard}>
          <View style={[s.auditIcon, { backgroundColor: entry.action === 'sale_refunded' ? c.accent : c.secondary }]}><Ionicons name={entry.action === 'sale_refunded' ? 'arrow-undo-outline' : 'close-circle-outline'} size={17} color={entry.action === 'sale_refunded' ? c.accentForeground : c.primary} /></View>
          <View style={s.flex}><Text style={[s.auditTitle, { color: c.foreground }]}>{entry.action === 'sale_refunded' ? 'Refund transaksi' : 'Order dibatalkan'}</Text><Text style={[s.auditDetail, { color: c.mutedForeground }]}>{entry.description}</Text><Text style={[s.auditDate, { color: c.mutedForeground }]}>{new Date(entry.date).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text></View>
          {entry.amount !== undefined ? <Text style={[s.auditAmount, { color: c.destructive }]}>−{formatRp(entry.amount)}</Text> : null}
        </Surface>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  periods: { flexDirection: 'row', gap: 7, marginBottom: 16 },
  period: { borderWidth: 1, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 13 },
  periodText: { fontSize: 11, fontWeight: '800' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 23 },
  summaryIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  summaryValue: { fontSize: 21, fontWeight: '800', marginTop: 4 },
  card: { marginBottom: 9, padding: 13 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  dateWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  icon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  flex: { flex: 1 },
  date: { fontSize: 14, fontWeight: '800' },
  meta: { fontSize: 11, marginTop: 3 },
  amount: { fontSize: 13, fontWeight: '800' },
  divider: { height: 1, marginVertical: 11 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  items: { flex: 1, fontSize: 11, lineHeight: 17 },
  table: { fontSize: 11, marginTop: 9 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  modal: { maxHeight: '91%', borderTopLeftRadius: 27, borderTopRightRadius: 27, padding: 22 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  modalKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginTop: 3 },
  modalMeta: { fontSize: 11, lineHeight: 17 },
  modalScroll: { marginTop: 9 },
  modalItems: { borderTopWidth: 1, borderBottomWidth: 1, marginTop: 16, paddingVertical: 6 },
  modalItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9 },
  itemCopy: { flex: 1, paddingRight: 12 },
  modalItemName: { fontSize: 13, fontWeight: '800' },
  modalItemMeta: { fontSize: 10, marginTop: 3 },
  modalItemAmount: { fontSize: 12, fontWeight: '800' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15 },
  totalLabel: { fontSize: 15, fontWeight: '800' },
  totalValue: { fontSize: 18, fontWeight: '800' },
  cashRows: { gap: 7, paddingBottom: 12 },
  cashRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 13 },
  actionButton: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  actionText: { fontSize: 11, fontWeight: '800' },
  shareButton: { minHeight: 44, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, marginTop: 8 },
  refundButton: { minHeight: 44, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, marginTop: 8 },
  refundedNote: { fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 10 },
  refundModal: { borderTopLeftRadius: 27, borderTopRightRadius: 27, padding: 22 },
  label: { fontSize: 11, fontWeight: '800', marginTop: 16, marginBottom: 7 },
  refundInput: { minHeight: 88, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingTop: 12, fontSize: 13, textAlignVertical: 'top', marginBottom: 15 },
  auditCard: { minHeight: 67, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  auditIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  auditTitle: { fontSize: 12, fontWeight: '800' },
  auditDetail: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  auditDate: { fontSize: 9, marginTop: 3 },
  auditAmount: { fontSize: 11, fontWeight: '800' },
});