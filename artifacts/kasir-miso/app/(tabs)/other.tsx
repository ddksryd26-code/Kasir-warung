import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, BackHandler, Image, Modal, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { reloadAppAsync } from 'expo';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { PageHeader, Screen, Surface } from '@/components/WarungUI';
import { useColors } from '@/hooks/useColors';
import { useWarung } from '@/context/WarungContext';
import { createOfflineBackup, parseOfflineBackup, type OfflineBackupEnvelope } from '@/utils/backupEnvelope';
import { persistImageAsset } from '@/utils/persistentImage';

const OFFLINE_BACKUP_KEY = 'warung-offline-backup-v1';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const formatBackupTime = (value: string) => {
  if (!value) return 'Belum pernah dibackup';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Backup tersimpan';
  return `Terakhir ${date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}`;
};

function MenuRow({
  icon,
  label,
  detail,
  onPress,
  testID,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
}) {
  const c = useColors();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.menuRow, { opacity: pressed || disabled ? 0.58 : 1 }]}
    >
      <View style={[s.menuIcon, { backgroundColor: c.muted }]}>
        <Ionicons name={icon} size={21} color={c.mutedForeground} />
      </View>
      <View style={s.menuCopy}>
        <Text style={[s.menuLabel, { color: c.foreground }]}>{label}</Text>
        {detail ? <Text style={[s.menuDetail, { color: c.mutedForeground }]}>{detail}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.mutedForeground} />
    </Pressable>
  );
}

export default function OtherScreen() {
  const c = useColors();
  const router = useRouter();
  const warung = useWarung();
  const [notice, setNotice] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoringOffline, setIsRestoringOffline] = useState(false);
  const [isQrisUploading, setIsQrisUploading] = useState(false);
  const [qrisSheetVisible, setQrisSheetVisible] = useState(false);

  const createBackup = () => ({
    ...createOfflineBackup({
      menus: warung.menus,
      activeOrders: warung.activeOrders,
      kitchenOrders: warung.kitchenOrders,
      inventory: warung.inventory,
      stockMovements: warung.stockMovements,
      consignments: warung.consignments,
      expenses: warung.expenses,
      sales: warung.sales,
      auditTrail: warung.auditTrail,
      savingsRules: warung.savingsRules,
      savingsEntries: warung.savingsEntries,
      qrisImageUri: warung.qrisImageUri,
    }),
  });

  const handleOfflineBackup = async () => {
    setIsBackingUp(true);
    try {
      const backup = createBackup();
      const backupJson = JSON.stringify(backup);
      await AsyncStorage.setItem(OFFLINE_BACKUP_KEY, backupJson);

      if (Platform.OS === 'web') {
        const blob = new Blob([backupJson], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `kasir-miso-backup-${backup.createdAt.slice(0, 10)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        setNotice('Backup offline tersimpan dan file JSON sudah diunduh.');
      } else {
        await Share.share({
          title: 'Backup Kasir Miso',
          message: 'Backup offline tersimpan di perangkat. Simpan file ini jika ingin memindahkannya.',
        });
        setNotice('Backup offline tersimpan di perangkat.');
      }
    } catch {
      setNotice('Backup offline belum berhasil. Coba lagi.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const requestOfflineRestore = (backup: OfflineBackupEnvelope, sourceLabel: string) => {
    if (isRestoringOffline) return;
    const backupDate = formatBackupTime(backup.createdAt).toLowerCase();
      Alert.alert(
        'Pulihkan cadangan offline?',
        `Data aplikasi akan diganti dengan salinan ${sourceLabel} ${backupDate}.`,
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Pulihkan',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setIsRestoringOffline(true);
                try {
                  await warung.restoreState(backup.data);
                  Alert.alert(
                    'Pemulihan selesai',
                    'Cadangan offline sudah dipulihkan. Muat ulang aplikasi untuk melihat seluruh data.',
                    [{ text: 'Muat ulang', onPress: () => void reloadAppAsync() }],
                  );
                } catch {
                  setNotice('Pemulihan offline belum berhasil. Cadangan asli tetap dipertahankan.');
                } finally {
                  setIsRestoringOffline(false);
                }
              })();
            },
          },
        ],
      );
  };

  const handleOfflineRestore = async () => {
    if (isRestoringOffline) return;
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_BACKUP_KEY);
      if (!raw) {
        setNotice('Belum ada cadangan offline di perangkat ini. Buat Backup Offline terlebih dahulu.');
        return;
      }
      requestOfflineRestore(parseOfflineBackup(raw), 'perangkat');
    } catch {
      setNotice('Cadangan offline tidak bisa dibaca. Buat cadangan baru lalu coba lagi.');
    }
  };

  const handleFileOfflineRestore = async () => {
    if (isRestoringOffline) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const raw = Platform.OS === 'web' && asset.file
        ? await asset.file.text()
        : await FileSystem.readAsStringAsync(asset.uri, { encoding: 'utf8' });
      requestOfflineRestore(parseOfflineBackup(raw), `file "${asset.name}"`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'File backup tidak bisa dibaca.');
    }
  };

  const handleUploadQris = async () => {
    if (isQrisUploading) return;
    setIsQrisUploading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        warung.setQrisImageUri(await persistImageAsset(result.assets[0]));
        setNotice('Gambar QRIS tersimpan dan akan tampil saat pembayaran QRIS dibuka.');
        setQrisSheetVisible(false);
      }
    } catch {
      setNotice('Gambar QRIS tidak bisa dibuka. Coba pilih gambar lain.');
    } finally {
      setIsQrisUploading(false);
    }
  };

  const showComingSoon = (label: string) => {
    setNotice(`${label} belum tersedia. Tombolnya sudah disiapkan untuk pengembangan berikutnya.`);
  };

  const handleCloseApp = () => {
    if (Platform.OS === 'android') {
      Alert.alert('Tutup aplikasi?', 'Aplikasi akan ditutup dari perangkat ini.', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Tutup', style: 'destructive', onPress: () => BackHandler.exitApp() },
      ]);
      return;
    }

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.close();
      setNotice('Tab aplikasi tidak dapat ditutup otomatis dari browser. Silakan tutup tab ini.');
      return;
    }

    setNotice('Di iPhone, aplikasi perlu ditutup melalui pengalih aplikasi.');
  };

  return (
    <Screen>
      <PageHeader
        eyebrow="Alat bantu warung"
        title="Lainnya"
        subtitle="Buat warung lebih mudah dikenali dan pekerjaan harian lebih teratur."
      />

      <View style={s.shortcutSection}>
        {[
          { label: 'Kartu ucapan', icon: 'gift-outline' as IconName, onPress: () => showComingSoon('Kartu ucapan'), testID: 'greeting-card-button' },
          { label: 'Kartu bisnis', icon: 'card-outline' as IconName, onPress: () => router.push('/business-card'), testID: 'business-card-button' },
          { label: 'Pengingat', icon: 'calendar-outline' as IconName, onPress: () => router.push('/reminders'), testID: 'reminder-button' },
        ].map((item) => (
          <Pressable
            key={item.label}
            testID={item.testID}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={item.onPress}
            style={({ pressed }) => [s.shortcut, { opacity: pressed ? 0.58 : 1 }]}
          >
            <View style={[s.shortcutIcon, { backgroundColor: c.muted }]}>
              <Ionicons name={item.icon} size={24} color={c.mutedForeground} />
            </View>
            <Text style={[s.shortcutLabel, { color: c.foreground }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[s.groupTitle, { color: c.mutedForeground }]}>Manajemen</Text>
      <Surface style={s.menuCard}>
        <MenuRow icon="business-outline" label="Profil Usaha" onPress={() => router.push('/business-profile')} />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow icon="people-outline" label="Kelola Staf" onPress={() => router.push('/staff')} />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow icon="cube-outline" label="Edit data stok" detail="Kelola menu, bahan baku, dan barang titipan" onPress={() => router.push('/stock-edit')} />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow
          icon="swap-vertical-outline"
          label="Arus Kas"
          detail="Lihat uang masuk, keluar, dan saldo bersih"
          testID="cash-flow-button"
          onPress={() => router.push('/cash-flow')}
        />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow icon="grid-outline" label="Kelola Kategori" onPress={() => router.push('/inventory')} />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow icon="bar-chart-outline" label="Lihat Laporan" onPress={() => router.push('/reports')} />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow
          icon="settings-outline"
          label="Pengaturan"
          testID="settings-button"
          onPress={() => router.push('/settings')}
        />
      </Surface>

      <Text style={[s.groupTitle, { color: c.mutedForeground }]}>Utilitas</Text>
      <Surface style={s.menuCard}>
        <MenuRow
          icon="qr-code-outline"
          label="Upload QRIS"
          detail={warung.qrisImageUri ? 'Ganti gambar QRIS pembayaran' : 'Tambahkan gambar QRIS pembayaran'}
          testID="qris-upload-button"
          onPress={() => setQrisSheetVisible(true)}
        />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow
          icon="download-outline"
          label="Backup Offline"
          detail="Simpan salinan data di perangkat"
          testID="offline-backup-button"
          disabled={isBackingUp}
          onPress={() => void handleOfflineBackup()}
        />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow
          icon="refresh-circle-outline"
          label="Pulihkan Offline"
          detail={isRestoringOffline ? 'Sedang memulihkan data...' : 'Kembalikan salinan terakhir di perangkat'}
          testID="offline-restore-button"
          disabled={isRestoringOffline}
          onPress={() => void handleOfflineRestore()}
        />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow
          icon="folder-open-outline"
          label="Pulihkan dari File"
          detail="Pilih backup JSON dari perangkat lain"
          testID="offline-file-restore-button"
          disabled={isRestoringOffline}
          onPress={() => void handleFileOfflineRestore()}
        />
      </Surface>

      <Text style={[s.groupTitle, { color: c.mutedForeground }]}>Lainnya</Text>
      <Surface style={s.menuCard}>
        <MenuRow
          icon="information-circle-outline"
          label="Informasi"
          testID="information-button"
          onPress={() => Alert.alert('Informasi', 'Kasir Miso membantu mencatat penjualan, stok, biaya, dan laporan warung dalam satu aplikasi.')}
        />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow
          icon="archive-outline"
          label="Cadangan"
          detail="Buat salinan data warung"
          testID="additional-backup-button"
          disabled={isBackingUp}
          onPress={() => void handleOfflineBackup()}
        />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow
          icon="help-circle-outline"
          label="Tentang aplikasi ini"
          testID="about-app-button"
          onPress={() => Alert.alert('Tentang Kasir Miso', 'Kasir Miso · Versi 4.5.8\nAplikasi kasir sederhana untuk membantu warung bekerja lebih teratur.')}
        />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow
          icon="power-outline"
          label="Tutup aplikasi"
          detail="Keluar dari aplikasi ini"
          testID="close-app-button"
          onPress={handleCloseApp}
        />
      </Surface>

      {notice ? (
        <View style={[s.notice, { backgroundColor: c.secondary }]}>
          <Ionicons name="information-circle-outline" size={17} color={c.primary} />
          <Text style={[s.noticeText, { color: c.secondaryForeground }]}>
            {notice}
          </Text>
        </View>
      ) : null}

      <Modal
        visible={qrisSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setQrisSheetVisible(false)}
      >
        <View style={[s.sheetBackdrop, { backgroundColor: c.foreground + 'B8' }]}>
          <View style={[s.qrisSheet, { backgroundColor: c.card }]}>
            <View style={s.sheetTopline}>
              <View style={[s.sheetIcon, { backgroundColor: c.secondary }]}>
                <Ionicons name="qr-code-outline" size={25} color={c.primary} />
              </View>
              <Pressable
                accessibilityLabel="Tutup pengaturan QRIS"
                onPress={() => setQrisSheetVisible(false)}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={28} color={c.mutedForeground} />
              </Pressable>
            </View>
            <Text style={[s.sheetKicker, { color: c.primary }]}>PEMBAYARAN DIGITAL</Text>
            <Text style={[s.sheetTitle, { color: c.foreground }]}>QRIS Warung</Text>
            <Text style={[s.sheetBody, { color: c.mutedForeground }]}>
              Simpan gambar QRIS di sini agar kasir bisa langsung menampilkannya saat pelanggan memilih pembayaran QRIS.
            </Text>
            {warung.qrisImageUri ? (
              <Image source={{ uri: warung.qrisImageUri }} resizeMode="contain" style={s.qrisPreview} />
            ) : (
              <View style={[s.qrisEmpty, { backgroundColor: c.secondary, borderColor: c.border }]}>
                <Ionicons name="image-outline" size={28} color={c.primary} />
                <Text style={[s.qrisEmptyText, { color: c.mutedForeground }]}>Belum ada gambar QRIS</Text>
              </View>
            )}
            <Pressable
              testID="choose-qris-image-button"
              accessibilityRole="button"
              accessibilityLabel={warung.qrisImageUri ? 'Ganti gambar QRIS' : 'Pilih gambar QRIS'}
              disabled={isQrisUploading}
              onPress={() => void handleUploadQris()}
              style={({ pressed }) => [
                s.primaryAction,
                { backgroundColor: c.primary, opacity: pressed || isQrisUploading ? 0.58 : 1 },
              ]}
            >
              <Ionicons name="image-outline" size={19} color={c.primaryForeground} />
              <Text style={[s.primaryActionText, { color: c.primaryForeground }]}>
                {isQrisUploading ? 'Membuka galeri...' : warung.qrisImageUri ? 'Ganti gambar QRIS' : 'Pilih gambar QRIS'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  shortcutSection: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  shortcut: { flex: 1, alignItems: 'center', paddingVertical: 7 },
  shortcutIcon: { width: 58, height: 58, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  shortcutLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  groupTitle: { fontSize: 13, fontWeight: '600', marginTop: 17, marginBottom: 8, marginLeft: 4 },
  menuCard: { padding: 0, overflow: 'hidden' },
  menuRow: { minHeight: 67, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' },
  menuIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  menuCopy: { flex: 1, paddingRight: 8 },
  menuLabel: { fontSize: 15, fontWeight: '600' },
  menuDetail: { fontSize: 11, marginTop: 3 },
  rowDivider: { height: 1, marginLeft: 65 },
  notice: { minHeight: 44, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end' },
  qrisSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  sheetTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  sheetIcon: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sheetKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  sheetTitle: { fontSize: 23, fontWeight: '800', marginTop: 4 },
  sheetBody: { fontSize: 12, lineHeight: 18, marginTop: 7 },
  primaryAction: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, marginTop: 18 },
  primaryActionText: { fontSize: 14, fontWeight: '800' },
  qrisPreview: { width: 220, height: 220, alignSelf: 'center', marginTop: 18, borderRadius: 16 },
  qrisEmpty: { width: 220, height: 160, alignSelf: 'center', marginTop: 18, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 7 },
  qrisEmptyText: { fontSize: 12, fontWeight: '700' },
  actionCard: { minHeight: 148, padding: 17, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  actionIcon: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  actionCopy: { flex: 1 },
  actionTitle: { fontSize: 17, fontWeight: '800' },
  actionBody: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  actionLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  actionLinkText: { fontSize: 11, fontWeight: '800' },
});