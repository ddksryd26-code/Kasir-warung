import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PageHeader, Screen, Surface } from '@/components/WarungUI';
import { themeOptions } from '@/constants/colors';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type PickerName = 'theme' | 'mode' | null;

function SettingsPickerRow({
  icon,
  label,
  value,
  onPress,
  swatch,
  testID,
}: {
  icon: IconName;
  label: string;
  value: string;
  onPress: () => void;
  swatch?: string;
  testID?: string;
}) {
  const c = useColors();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}. Buka pilihan`}
      onPress={onPress}
      style={({ pressed }) => [
        s.pickerRow,
        { opacity: pressed ? 0.68 : 1 },
      ]}
    >
      <View style={[s.rowIcon, { backgroundColor: c.muted }]}>
        <Ionicons name={icon} size={20} color={c.mutedForeground} />
      </View>
      <Text style={[s.rowLabel, { color: c.foreground }]}>{label}</Text>
      <View style={s.rowValue}>
        {swatch ? <View style={[s.rowSwatch, { backgroundColor: swatch }]} /> : null}
        {!swatch ? <Text style={[s.rowValueText, { color: c.mutedForeground }]}>{value}</Text> : null}
        <Ionicons name="chevron-forward" size={19} color={c.mutedForeground} />
      </View>
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
  const [picker, setPicker] = useState<PickerName>(null);
  const selectedTheme = themeOptions.find((option) => option.id === themeId);
  const modeLabel = mode === 'light' ? 'Terang' : 'Gelap';

  const selectMode = (nextMode: 'light' | 'dark') => {
    if (nextMode !== mode) toggleMode();
    setPicker(null);
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
          </View>
        }
      />

      <View style={s.section}>
        <Text style={[s.sectionKicker, { color: c.primary }]}>TAMPILAN</Text>
        <Text style={[s.sectionBody, { color: c.mutedForeground }]}>
          Pilihan tampilan tersimpan otomatis di perangkat ini.
        </Text>
        <Surface style={s.settingsCard}>
          <SettingsPickerRow
            icon="color-palette-outline"
            label="Tema warna"
            value={selectedTheme?.label ?? 'Pilih tema'}
            swatch={selectedTheme?.swatch ?? c.primary}
            testID="theme-picker-row"
            onPress={() => setPicker('theme')}
          />
          <View style={[s.rowDivider, { backgroundColor: c.border }]} />
          <SettingsPickerRow
            icon={mode === 'light' ? 'sunny-outline' : 'moon-outline'}
            label="Mode aplikasi"
            value={modeLabel}
            testID="mode-picker-row"
            onPress={() => setPicker('mode')}
          />
        </Surface>
      </View>

      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <View style={[s.modalBackdrop, { backgroundColor: c.foreground + 'B8' }]}>
          <View style={[s.pickerModal, { backgroundColor: c.card }]}>
            <View style={s.modalHeader}>
              <View>
                <Text style={[s.modalKicker, { color: c.primary }]}>TAMPILAN APLIKASI</Text>
                <Text style={[s.modalTitle, { color: c.foreground }]}>
                  {picker === 'theme' ? 'Pilih tema warna' : 'Pilih mode aplikasi'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tutup pilihan"
                hitSlop={8}
                onPress={() => setPicker(null)}
              >
                <Ionicons name="close-circle" size={27} color={c.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView
              style={s.choiceScroll}
              contentContainerStyle={s.choiceList}
              showsVerticalScrollIndicator={false}
            >
              {picker === 'theme'
                ? themeOptions.map((option) => {
                    const selected = option.id === themeId;
                    return (
                      <Pressable
                        key={option.id}
                        testID={`theme-option-${option.id}`}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`Tema ${option.label}`}
                        onPress={() => {
                          selectTheme(option.id);
                          setPicker(null);
                        }}
                        style={({ pressed }) => [
                          s.choiceRow,
                          {
                            backgroundColor: selected ? c.secondary : c.card,
                            borderColor: selected ? c.primary : c.border,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <View style={[s.choiceSwatch, { backgroundColor: option.swatch }]}>
                          {selected ? <Ionicons name="checkmark" size={17} color={c.primaryForeground} /> : null}
                        </View>
                        <View style={s.choiceCopy}>
                          <Text style={[s.choiceLabel, { color: c.foreground }]}>{option.label}</Text>
                          <Text style={[s.choiceDetail, { color: c.mutedForeground }]}>{option.description}</Text>
                        </View>
                        {selected ? <Ionicons name="checkmark-circle" size={20} color={c.primary} /> : null}
                      </Pressable>
                    );
                  })
                : (
                    <>
                      <Pressable
                        testID="light-mode-option"
                        accessibilityRole="radio"
                        accessibilityState={{ selected: mode === 'light' }}
                        accessibilityLabel="Mode terang"
                        onPress={() => selectMode('light')}
                        style={({ pressed }) => [
                          s.choiceRow,
                          {
                            backgroundColor: mode === 'light' ? c.secondary : c.card,
                            borderColor: mode === 'light' ? c.primary : c.border,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <View style={[s.modeIcon, { backgroundColor: mode === 'light' ? c.primary : c.muted }]}>
                          <Ionicons name="sunny-outline" size={19} color={mode === 'light' ? c.primaryForeground : c.mutedForeground} />
                        </View>
                        <View style={s.choiceCopy}>
                          <Text style={[s.choiceLabel, { color: c.foreground }]}>Mode terang</Text>
                          <Text style={[s.choiceDetail, { color: c.mutedForeground }]}>Tampilan cerah untuk siang hari</Text>
                        </View>
                        {mode === 'light' ? <Ionicons name="checkmark-circle" size={20} color={c.primary} /> : null}
                      </Pressable>
                      <Pressable
                        testID="dark-mode-option"
                        accessibilityRole="radio"
                        accessibilityState={{ selected: mode === 'dark' }}
                        accessibilityLabel="Mode gelap"
                        onPress={() => selectMode('dark')}
                        style={({ pressed }) => [
                          s.choiceRow,
                          {
                            backgroundColor: mode === 'dark' ? c.secondary : c.card,
                            borderColor: mode === 'dark' ? c.primary : c.border,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <View style={[s.modeIcon, { backgroundColor: mode === 'dark' ? c.primary : c.muted }]}>
                          <Ionicons name="moon-outline" size={19} color={mode === 'dark' ? c.primaryForeground : c.mutedForeground} />
                        </View>
                        <View style={s.choiceCopy}>
                          <Text style={[s.choiceLabel, { color: c.foreground }]}>Mode gelap</Text>
                          <Text style={[s.choiceDetail, { color: c.mutedForeground }]}>Tampilan redup untuk malam hari</Text>
                        </View>
                        {mode === 'dark' ? <Ionicons name="checkmark-circle" size={20} color={c.primary} /> : null}
                      </Pressable>
                    </>
                  )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  section: { marginBottom: 16 },
  sectionKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: 2 },
  sectionBody: { fontSize: 11, lineHeight: 16, marginTop: 3, marginBottom: 8 },
  settingsCard: { padding: 0, overflow: 'hidden' },
  pickerRow: { minHeight: 62, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center' },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '700' },
  rowValue: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rowValueText: { fontSize: 12, fontWeight: '700' },
  rowSwatch: { width: 19, height: 19, borderRadius: 7 },
  rowDivider: { height: 1, marginLeft: 65 },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 22 },
  pickerModal: { width: '100%', maxHeight: '84%', borderRadius: 24, padding: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  modalKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginTop: 3 },
  choiceScroll: { flexGrow: 0 },
  choiceList: { gap: 8, paddingBottom: 2 },
  choiceRow: { minHeight: 56, borderWidth: 1, borderRadius: 13, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
  choiceSwatch: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  modeIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  choiceCopy: { flex: 1, paddingRight: 6 },
  choiceLabel: { fontSize: 13, fontWeight: '800' },
  choiceDetail: { fontSize: 10, marginTop: 1, lineHeight: 13 },
});