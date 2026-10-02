import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PageHeader, Screen, Surface, ThemeActions } from '@/components/WarungUI';
import { themeOptions } from '@/constants/colors';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

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
  return <SettingsContent />;
}

function SettingsContent() {
  const c = useColors();
  const router = useRouter();
  const { mode, themeId, selectTheme, toggleMode } = useTheme();

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
  section: { marginBottom: 16 },
  sectionKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginTop: 3 },
  sectionBody: { fontSize: 11, lineHeight: 16, marginTop: 3, marginBottom: 8 },
  themeList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  themeOption: { width: '48%', minHeight: 54, borderWidth: 1, borderRadius: 13, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  themeSwatch: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingCopy: { flex: 1, paddingRight: 8 },
  settingLabel: { fontSize: 12, fontWeight: '800' },
  settingDetail: { fontSize: 10, marginTop: 1, lineHeight: 13 },
  modeCard: { padding: 7, gap: 6 },
  settingRow: { minHeight: 56, borderWidth: 1, borderRadius: 12, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  savedNotice: { minHeight: 40, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  savedNoticeText: { flex: 1, fontSize: 10, fontWeight: '700', lineHeight: 14 },
});