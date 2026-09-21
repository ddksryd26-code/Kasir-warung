import { Ionicons } from '@expo/vector-icons';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSaveDriveBackup, type SaveDriveBackupBody } from '@workspace/api-client-react';
import { PageHeader, PrimaryButton, Screen, Surface, ThemeActions } from '@/components/WarungUI';
import { themeOptions } from '@/constants/colors';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useWarung } from '@/context/WarungContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function SettingRow({
  icon,
  label,
  detail,
  onPress,
  selected = false,
  testID,
}: {
  icon: IconName;
  label: string;
  detail: string;
  onPress: () => void;
  selected?: boolean;
  testID?: string;
}) {
  const c = useColors();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [
        s.settingRow,
        {
          backgroundColor: selected ? c.secondary : c.card,
          borderColor: selected ? c.primary : c.border,
          opacity: pressed ? 0.68 : 1,
        },
      ]}
    >
      <View style={[s.settingIcon, { backgroundColor: selected ? c.primary : c.muted }]}>
        <Ionicons name={icon} size={20} color={selected ? c.primaryForeground : c.mutedForeground} />
      </View>
      <View style={s.settingCopy}>
        <Text style={[s.settingLabel, { color: c.foreground }]}>{label}</Text>
        <Text style={[s.settingDetail, { color: c.mutedForeground }]}>{detail}</Text>
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={22} color={c.primary} /> : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const c = useColors();
  const router = useRouter();
  const { mode, themeId, selectTheme, toggleMode } = useTheme();
  const warung = useWarung();
  const backupMutation = useSaveDriveBackup({
    mutation: {
      onSuccess: () => {
        Alert.alert('Backup berhasil', 'Salinan data Kasir Miso sudah tersimpan di Google Drive.');
      },
      onError: () => {
        Alert.alert('Backup gagal', 'Data belum tersimpan ke Google Drive. Periksa koneksi lalu coba lagi.');
      },
    },
  });

  const handleDriveBackup = () => {
    if (!warung.hydrated || backupMutation.isPending) return;
    backupMutation.mutate({
      data: {
        state: {
          menus: warung.menus,
          activeOrders: warung.activeOrders,
          kitchenOrders: warung.kitchenOrders,
          inventory: warung.inventory,
          stockMovements: warung.stockMovements,
          consignments: warung.consignments,
          expenses: warung.expenses,
          sales: warung.sales,
          auditTrail: warung.auditTrail,
          cashClosures: warung.cashClosures,
          savingsRules: warung.savingsRules,
          savingsEntries: warung.savingsEntries,
          qrisImageUri: warung.qrisImageUri,
        } as unknown as SaveDriveBackupBody['state'],
      },
    });
  };

  return (
    <Screen>
      <PageHeader
        eyebrow="Preferensi aplikasi"
        title="Pengaturan"
        subtitle="Atur tampilan Kasir Miso sesuai kebiasaanmu."
        action={
          <View style={s.headerActions}>
            <Pressable
              accessibilityLabel="Kembali ke Lainnya"
              hitSlop={10}
              onPress={() => router.back()}
              style={({ pressed }) => [s.backButton, { backgroundColor: c.primaryForeground, opacity: pressed ? 0.72 : 1 }]}
            >
              <Ionicons name="arrow-back" size={20} color={c.primary} />
            </Pressable>
            <ThemeActions />
          </View>
        }
      />

      <View style={s.section}>
        <Text style={[s.sectionKicker, { color: c.primary }]}>TAMPILAN</Text>
        <Text style={[s.sectionTitle, { color: c.foreground }]}>Tema warna</Text>
        <Text style={[s.sectionBody, { color: c.mutedForeground }]}>
          Pilih warna utama yang digunakan di seluruh aplikasi.
        </Text>
        <View style={s.themeList}>
          {themeOptions.map((option) => (
            <Pressable
              key={option.id}
              testID={`theme-option-${option.id}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: option.id === themeId }}
              accessibilityLabel={`Tema ${option.label}`}
              onPress={() => selectTheme(option.id)}
              style={({ pressed }) => [
                s.themeOption,
                {
                  backgroundColor: option.id === themeId ? c.secondary : c.card,
                  borderColor: option.id === themeId ? c.primary : c.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View style={[s.themeSwatch, { backgroundColor: option.swatch }]}>
                {option.id === themeId ? <Ionicons name="checkmark" size={19} color={c.primaryForeground} /> : null}
              </View>
              <View style={s.settingCopy}>
                <Text style={[s.settingLabel, { color: c.foreground }]}>{option.label}</Text>
                <Text style={[s.settingDetail, { color: c.mutedForeground }]}>{option.description}</Text>
              </View>
              {option.id === themeId ? <Ionicons name="checkmark-circle" size={21} color={c.primary} /> : null}
            </Pressable>
          ))}
        </View>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionKicker, { color: c.primary }]}>MODE TAMPILAN</Text>
        <Text style={[s.sectionTitle, { color: c.foreground }]}>Mode aplikasi</Text>
        <Text style={[s.sectionBody, { color: c.mutedForeground }]}>
          Pilihan mode akan diterapkan dan disimpan otomatis.
        </Text>
        <Surface style={s.modeCard}>
          <SettingRow
            icon="sunny-outline"
            label="Mode terang"
            detail="Tampilan cerah untuk penggunaan siang hari"
            selected={mode === 'light'}
            testID="light-mode-option"
            onPress={() => {
              if (mode !== 'light') toggleMode();
            }}
          />
          <SettingRow
            icon="moon-outline"
            label="Mode gelap"
            detail="Tampilan redup untuk penggunaan malam hari"
            selected={mode === 'dark'}
            testID="dark-mode-option"
            onPress={() => {
              if (mode !== 'dark') toggleMode();
            }}
          />
        </Surface>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionKicker, { color: c.primary }]}>KEAMANAN DATA</Text>
        <Text style={[s.sectionTitle, { color: c.foreground }]}>Backup ke Google Drive</Text>
        <Text style={[s.sectionBody, { color: c.mutedForeground }]}>
          Simpan salinan data warung sebagai file baru di Google Drive. Setiap backup dibuat terpisah agar riwayat data tetap aman.
        </Text>
        <Surface style={s.backupCard}>
          <View style={[s.backupIcon, { backgroundColor: c.secondary }]}>
            <Ionicons name="cloud-upload-outline" size={22} color={c.primary} />
          </View>
          <View style={s.backupCopy}>
            <Text style={[s.settingLabel, { color: c.foreground }]}>
              {backupMutation.isSuccess ? `Tersimpan: ${backupMutation.data?.name ?? 'backup terbaru'}` : 'Belum ada backup dari perangkat ini'}
            </Text>
            <Text style={[s.settingDetail, { color: c.mutedForeground }]}>
              Koneksi Google Drive dikelola secara aman. Tidak perlu memasukkan client secret atau token ke aplikasi.
            </Text>
          </View>
          <PrimaryButton
            testID="google-drive-backup"
            icon="cloud-upload-outline"
            disabled={!warung.hydrated || backupMutation.isPending}
            onPress={handleDriveBackup}
          >
            {backupMutation.isPending ? 'Menyimpan...' : 'Backup sekarang'}
          </PrimaryButton>
          {backupMutation.data?.webViewLink ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Buka backup terbaru di Google Drive"
              onPress={() => void Linking.openURL(backupMutation.data?.webViewLink ?? '')}
              style={({ pressed }) => [s.driveLink, { opacity: pressed ? 0.65 : 1 }]}
            >
              <Ionicons name="open-outline" size={16} color={c.primary} />
              <Text style={[s.driveLinkText, { color: c.primary }]}>Buka di Google Drive</Text>
            </Pressable>
          ) : null}
        </Surface>
      </View>

      <View style={[s.savedNotice, { backgroundColor: c.secondary }]}>
        <Ionicons name="checkmark-circle-outline" size={18} color={c.primary} />
        <Text style={[s.savedNoticeText, { color: c.secondaryForeground }]}>
          Pengaturan tersimpan otomatis di perangkat ini.
        </Text>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  section: { marginBottom: 23 },
  sectionKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: 2 },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  sectionBody: { fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: 12 },
  themeList: { gap: 9 },
  themeOption: { minHeight: 62, borderWidth: 1, borderRadius: 15, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  themeSwatch: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  settingCopy: { flex: 1, paddingRight: 8 },
  settingLabel: { fontSize: 14, fontWeight: '800' },
  settingDetail: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  modeCard: { padding: 9, gap: 8 },
  settingRow: { minHeight: 66, borderWidth: 1, borderRadius: 14, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  backupCard: { gap: 11 },
  backupIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  backupCopy: { gap: 2 },
  driveLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  driveLinkText: { fontSize: 12, fontWeight: '800' },
  savedNotice: { minHeight: 44, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  savedNoticeText: { flex: 1, fontSize: 11, fontWeight: '700', lineHeight: 16 },
});