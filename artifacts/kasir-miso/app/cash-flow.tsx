import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  formatRp,
  isDateInReportPeriod,
  type ReportPeriod,
  useWarung,
} from '@/context/WarungContext';
import { getPendingSales, summarizeCashClosing } from '@/domain/cashClosing';
import { useColors } from '@/hooks/useColors';
import { Badge, EmptyState, PageHeader, PrimaryButton, Screen, SectionHeader, Surface } from '@/components/WarungUI';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

type FlowKind = 'in' | 'out';
type FlowEntry = {
  id: string;
  kind: FlowKind;
  title: string;
  detail: string;
  amount: number;
  date: string;
};

const periods: ReportPeriod[] = ['Hari ini', 'Minggu ini', 'Bulan ini'];

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function CashFlowScreen() {
  const c = useColors();
  const { sales, expenses, cashClosures, closeCash } = useWarung();
  const [period, setPeriod] = useState<ReportPeriod>('Hari ini');
  const [closing, setClosing] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [cashExpenses, setCashExpenses] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [notes, setNotes] = useState('');
  const entries = useMemo<FlowEntry[]>(() => [
    ...sales.map((sale) => ({
      id: `sale-${sale.id}`,
      kind: 'in' as const,
      title: 'Penjualan',
      detail: `${sale.method} · ${sale.items.reduce((sum, item) => sum + item.qty, 0)} item`,
      amount: sale.amount,
      date: sale.date,
    })),
    ...expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      kind: 'out' as const,
      title: expense.title,
      detail: 'Pengeluaran operasional',
      amount: expense.amount,
      date: expense.date,
    })),
  ]
    .filter((entry) => isDateInReportPeriod(entry.date, period))
    .sort((a, b) => b.date.localeCompare(a.date)),
  [expenses, period, sales]);

  const incoming = entries.filter((entry) => entry.kind === 'in').reduce((sum, entry) => sum + entry.amount, 0);
  const outgoing = entries.filter((entry) => entry.kind === 'out').reduce((sum, entry) => sum + entry.amount, 0);
  const balance = incoming - outgoing;
  const pendingSales = useMemo(() => getPendingSales(sales, cashClosures), [cashClosures, sales]);
  const pendingSummary = useMemo(() => summarizeCashClosing(pendingSales, 0, 0, 0), [pendingSales]);
  const countedValue = Number(countedCash);
  const openingValue = Number(openingCash);
  const cashExpensesValue = Number(cashExpenses);
  const liveSummary = useMemo(
    () => summarizeCashClosing(pendingSales, Number.isFinite(openingValue) ? openingValue : 0, Number.isFinite(cashExpensesValue) ? cashExpensesValue : 0, Number.isFinite(countedValue) ? countedValue : 0),
    [cashExpensesValue, countedValue, openingValue, pendingSales],
  );
  const latestClosure = cashClosures[cashClosures.length - 1];
  const openClosing = () => {
    setOpeningCash(latestClosure ? String(latestClosure.countedCash) : '');
    setCashExpenses('');
    setCountedCash('');
    setNotes('');
    setClosing(true);
  };
  const confirmClosing = () => {
    if (!Number.isFinite(openingValue) || openingValue < 0 || !Number.isFinite(countedValue) || countedValue < 0 || !Number.isFinite(cashExpensesValue) || cashExpensesValue < 0) {
      Alert.alert('Data belum lengkap', 'Isi modal awal, pengeluaran tunai, dan uang fisik dengan nominal yang valid.');
      return;
    }
    closeCash(openingValue, cashExpensesValue, countedValue, pendingSales.map((sale) => sale.id), notes);
    setClosing(false);
    Alert.alert('Kasir ditutup', `Rekonsiliasi tersimpan. ${liveSummary.difference === 0 ? 'Uang sesuai.' : `Selisih ${formatRp(Math.abs(liveSummary.difference))}.`}`);
  };
  const formatClosureDate = (value: string) => new Date(value).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <Screen>
      <PageHeader
        eyebrow="Keuangan warung"
        title="Arus kas"
        subtitle="Pantau uang yang masuk, keluar, dan saldo bersih."
        backRoute="/"
      />
      <View style={s.periods}>
        {periods.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: period === item }}
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
      <Surface tone="ink" style={s.balanceCard}>
        <Text style={[s.balanceLabel, { color: c.mutedForeground }]}>SALDO BERSIH · {period.toUpperCase()}</Text>
        <Text style={[s.balance, { color: c.card }]}>{formatRp(balance)}</Text>
        <Text style={[s.balanceCaption, { color: c.mutedForeground }]}>
          {formatRp(incoming)} masuk − {formatRp(outgoing)} keluar
        </Text>
      </Surface>
      <Surface style={s.closingCard}>
        <View style={s.closingHeader}>
          <View style={[s.closingIcon, { backgroundColor: c.secondary }]}>
            <Ionicons name="lock-closed-outline" size={21} color={c.primary} />
          </View>
          <View style={s.closingCopy}>
            <Text style={[s.closingTitle, { color: c.foreground }]}>Tutup kasir</Text>
            <Text style={[s.closingCaption, { color: c.mutedForeground }]}>
              {pendingSales.length ? `${pendingSales.length} transaksi belum direkonsiliasi.` : 'Semua transaksi sudah masuk penutupan.'}
            </Text>
          </View>
        </View>
        <View style={s.closingMetrics}>
          <View style={s.closingMetric}><Text style={[s.smallLabel, { color: c.mutedForeground }]}>TUNAI</Text><Text style={[s.closingMetricValue, { color: c.foreground }]}>{formatRp(pendingSummary.cashSales)}</Text></View>
          <View style={s.closingMetric}><Text style={[s.smallLabel, { color: c.mutedForeground }]}>QRIS</Text><Text style={[s.closingMetricValue, { color: c.foreground }]}>{formatRp(pendingSummary.qrisSales)}</Text></View>
        </View>
        <PrimaryButton testID="open-cash-closing" onPress={openClosing} icon="lock-closed-outline">Mulai rekonsiliasi</PrimaryButton>
      </Surface>
      <View style={s.metrics}>
        <Surface style={s.metric}>
          <View style={[s.metricIcon, { backgroundColor: c.secondary }]}>
            <Ionicons name="arrow-down-outline" size={19} color={c.primary} />
          </View>
          <Text style={[s.metricLabel, { color: c.mutedForeground }]}>Uang masuk</Text>
          <Text style={[s.metricValue, { color: c.foreground }]}>{formatRp(incoming)}</Text>
        </Surface>
        <Surface style={s.metric}>
          <View style={[s.metricIcon, { backgroundColor: c.accent }]}>
            <Ionicons name="arrow-up-outline" size={19} color={c.accentForeground} />
          </View>
          <Text style={[s.metricLabel, { color: c.mutedForeground }]}>Uang keluar</Text>
          <Text style={[s.metricValue, { color: c.foreground }]}>{formatRp(outgoing)}</Text>
        </Surface>
      </View>
      <SectionHeader title="Rincian arus kas" meta={`${entries.length} catatan`} icon="list-outline" />
      {!entries.length ? (
        <EmptyState
          icon="swap-vertical-outline"
          title="Belum ada arus kas"
          body={`Penjualan dan pengeluaran pada periode ${period.toLowerCase()} akan muncul di sini.`}
        />
      ) : (
        entries.map((entry) => (
          <Surface key={entry.id} style={s.entry}>
            <View style={[s.entryIcon, { backgroundColor: entry.kind === 'in' ? c.secondary : c.accent }]}>
              <Ionicons
                name={entry.kind === 'in' ? 'arrow-down-outline' : 'arrow-up-outline'}
                size={19}
                color={entry.kind === 'in' ? c.primary : c.accentForeground}
              />
            </View>
            <View style={s.entryCopy}>
              <Text style={[s.entryTitle, { color: c.foreground }]}>{entry.title}</Text>
              <Text style={[s.entryDetail, { color: c.mutedForeground }]}>
                {formatDate(entry.date)} · {entry.detail}
              </Text>
            </View>
            <View style={s.entryAmount}>
              <Text style={[s.amount, { color: entry.kind === 'in' ? c.primary : c.destructive }]}>
                {entry.kind === 'in' ? '+' : '−'}{formatRp(entry.amount)}
              </Text>
              <Badge tone={entry.kind === 'in' ? 'primary' : 'danger'}>
                {entry.kind === 'in' ? 'Masuk' : 'Keluar'}
              </Badge>
            </View>
          </Surface>
        ))
      )}
      <SectionHeader title="Riwayat tutup kasir" meta={cashClosures.length ? `${cashClosures.length} penutupan` : undefined} icon="lock-closed-outline" />
      {!cashClosures.length ? (
        <EmptyState icon="lock-open-outline" title="Belum ada penutupan kasir" body="Hasil rekonsiliasi akan muncul setelah kasir ditutup." />
      ) : (
        cashClosures.slice().reverse().slice(0, 5).map((closure) => (
          <Surface key={closure.id} style={s.closureCard}>
            <View style={[s.closureIcon, { backgroundColor: closure.difference === 0 ? c.secondary : c.accent }]}>
              <Ionicons name={closure.difference === 0 ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={19} color={closure.difference === 0 ? c.primary : c.accentForeground} />
            </View>
            <View style={s.closureCopy}>
              <Text style={[s.closureDate, { color: c.foreground }]}>{formatClosureDate(closure.closedAt)}</Text>
              <Text style={[s.closureDetail, { color: c.mutedForeground }]}>{closure.saleIds.length} transaksi · Diharapkan {formatRp(closure.expectedCash)}</Text>
            </View>
            <Text style={[s.closureDifference, { color: closure.difference === 0 ? c.primary : c.destructive }]}>
              {closure.difference === 0 ? 'Sesuai' : `${closure.difference > 0 ? '+' : '−'}${formatRp(Math.abs(closure.difference))}`}
            </Text>
          </Surface>
        ))
      )}
      <Modal visible={closing} transparent animationType="slide" onRequestClose={() => setClosing(false)}>
        <View style={[s.backdrop, { backgroundColor: c.foreground + 'B8' }]}>
          <KeyboardAwareScrollViewCompat style={s.modalScroll} contentContainerStyle={s.modalScrollContent} keyboardShouldPersistTaps="handled" bottomOffset={20}>
            <View style={[s.modal, { backgroundColor: c.card }]}>
              <View style={s.modalHeader}>
                <View>
                  <Text style={[s.modalKicker, { color: c.primary }]}>REKONSILIASI HARIAN</Text>
                  <Text style={[s.modalTitle, { color: c.foreground }]}>Tutup kasir</Text>
                </View>
                <Pressable accessibilityLabel="Tutup rekonsiliasi kasir" hitSlop={12} onPress={() => setClosing(false)}>
                  <Ionicons name="close-circle" size={27} color={c.mutedForeground} />
                </Pressable>
              </View>
              <Text style={[s.modalDescription, { color: c.mutedForeground }]}>Cocokkan uang di laci dengan transaksi yang belum pernah ditutup.</Text>
              <View style={[s.modalSummary, { backgroundColor: c.secondary }]}>
                <View><Text style={[s.smallLabel, { color: c.mutedForeground }]}>PENJUALAN TUNAI</Text><Text style={[s.modalValue, { color: c.foreground }]}>{formatRp(pendingSummary.cashSales)}</Text></View>
                <View style={s.modalSummaryRight}><Text style={[s.smallLabel, { color: c.mutedForeground }]}>QRIS</Text><Text style={[s.modalValue, { color: c.foreground }]}>{formatRp(pendingSummary.qrisSales)}</Text></View>
              </View>
              <Text style={[s.label, { color: c.mutedForeground }]}>Modal awal kasir</Text>
              <TextInput testID="opening-cash-input" value={openingCash} onChangeText={setOpeningCash} keyboardType="number-pad" placeholder="Rp 0" placeholderTextColor={c.mutedForeground} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
              <Text style={[s.label, { color: c.mutedForeground }]}>Pengeluaran tunai selama shift</Text>
              <TextInput testID="cash-expenses-input" value={cashExpenses} onChangeText={setCashExpenses} keyboardType="number-pad" placeholder="Rp 0" placeholderTextColor={c.mutedForeground} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
              <Text style={[s.helper, { color: c.mutedForeground }]}>Masukkan hanya pengeluaran yang diambil dari laci kas. Pengeluaran QRIS tidak mengurangi uang fisik.</Text>
              <Text style={[s.label, { color: c.mutedForeground }]}>Uang fisik di laci</Text>
              <TextInput testID="counted-cash-input" value={countedCash} onChangeText={setCountedCash} keyboardType="number-pad" placeholder="Rp 0" placeholderTextColor={c.mutedForeground} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
              <View style={[s.reconciliationBox, { backgroundColor: liveSummary.difference === 0 ? c.secondary : c.accent }]}>
                <View><Text style={[s.smallLabel, { color: c.mutedForeground }]}>SEHARUSNYA DI LACI</Text><Text style={[s.reconciliationValue, { color: c.foreground }]}>{formatRp(liveSummary.expectedCash)}</Text></View>
                <View style={s.modalSummaryRight}><Text style={[s.smallLabel, { color: c.mutedForeground }]}>SELISIH</Text><Text style={[s.reconciliationValue, { color: liveSummary.difference === 0 ? c.primary : c.accentForeground }]}>{countedCash.trim() ? `${liveSummary.difference > 0 ? '+' : ''}${formatRp(liveSummary.difference)}` : '—'}</Text></View>
              </View>
              <Text style={[s.label, { color: c.mutedForeground }]}>Catatan (opsional)</Text>
              <TextInput testID="cash-closing-notes" value={notes} onChangeText={setNotes} placeholder="Contoh: uang kecil dipakai belanja" placeholderTextColor={c.mutedForeground} multiline style={[s.input, s.notesInput, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
              <PrimaryButton testID="confirm-cash-closing" onPress={confirmClosing} icon="checkmark-circle-outline">Simpan penutupan</PrimaryButton>
            </View>
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  periods: { flexDirection: 'row', gap: 7, marginBottom: 16 },
  period: { borderWidth: 1, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 13 },
  periodText: { fontSize: 11, fontWeight: '800' },
  balanceCard: { marginBottom: 12 },
  balanceLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  balance: { fontSize: 30, fontWeight: '700', marginTop: 8 },
  balanceCaption: { fontSize: 11, marginTop: 7 },
  closingCard: { marginBottom: 22 },
  closingHeader: { flexDirection: 'row', alignItems: 'center' },
  closingIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  closingCopy: { flex: 1 },
  closingTitle: { fontSize: 16, fontWeight: '800' },
  closingCaption: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  closingMetrics: { flexDirection: 'row', gap: 10, marginVertical: 15 },
  closingMetric: { flex: 1, backgroundColor: 'transparent' },
  closingMetricValue: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  metrics: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  metric: { flex: 1, minHeight: 118 },
  metricIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { fontSize: 11, marginTop: 12 },
  smallLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  metricValue: { fontSize: 14, fontWeight: '800', marginTop: 4 },
  entry: { minHeight: 73, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  entryIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  entryCopy: { flex: 1, paddingRight: 8 },
  entryTitle: { fontSize: 14, fontWeight: '800' },
  entryDetail: { fontSize: 11, marginTop: 4 },
  entryAmount: { alignItems: 'flex-end', gap: 5 },
  amount: { fontSize: 12, fontWeight: '800' },
  closureCard: { minHeight: 67, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  closureIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  closureCopy: { flex: 1, paddingRight: 8 },
  closureDate: { fontSize: 13, fontWeight: '800' },
  closureDetail: { fontSize: 10, marginTop: 4 },
  closureDifference: { fontSize: 11, fontWeight: '800' },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  modalScroll: { maxHeight: '92%' },
  modalScrollContent: { justifyContent: 'flex-end', flexGrow: 1 },
  modal: { borderTopLeftRadius: 27, borderTopRightRadius: 27, padding: 22 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 13 },
  modalKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  modalTitle: { fontSize: 23, fontWeight: '800', marginTop: 3 },
  modalDescription: { fontSize: 12, lineHeight: 18, marginBottom: 15 },
  modalSummary: { borderRadius: 14, padding: 13, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  modalSummaryRight: { alignItems: 'flex-end' },
  modalValue: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  label: { fontSize: 11, fontWeight: '700', marginTop: 13, marginBottom: 6 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontSize: 14 },
  notesInput: { minHeight: 74, paddingTop: 12, textAlignVertical: 'top' },
  helper: { fontSize: 10, lineHeight: 15, marginTop: 6 },
  reconciliationBox: { borderRadius: 14, padding: 13, flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  reconciliationValue: { fontSize: 16, fontWeight: '800', marginTop: 4 },
});