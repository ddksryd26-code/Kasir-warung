import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useClerk, useUser } from '@clerk/expo';
import { PageHeader, PrimaryButton, Screen, Surface, ThemeActions } from '@/components/WarungUI';
import { themeOptions } from '@/constants/colors';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type SettingsAuthState = {
  isAuthLoaded: boolean;
  isSignedIn: boolean;
  user: ReturnType<typeof useUser>['user'];
  signOut: () => Promise<void>;
};

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
  if (process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <AuthenticatedSettingsScreen />;
  }

  return (
    <SettingsContent
      auth={{
        isAuthLoaded: true,
        isSignedIn: false,
        user: null,
        signOut: async () => undefined,
      }}
    />
  );
}

function AuthenticatedSettingsScreen() {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  return (
    <SettingsContent
      auth={{
        isAuthLoaded,
        isSignedIn: Boolean(isSignedIn),
        user,
        signOut,
      }}
    />
  );
}

function SettingsContent({ auth }: { auth: SettingsAuthState }) {
  const c = useColors();
  const router = useRouter();
  const { mode, themeId, selectTheme, toggleMode } = useTheme();
  const { isAuthLoaded, isSignedIn, user, signOut } = auth;
  const [accountNotice, setAccountNotice] = useState('');

  const handleSignOut = async () => {
    try {
      await signOut();
      setAccountNotice('Kamu sudah keluar dari akun Kasir Miso.');
    } catch {
      setAccountNotice('Akun belum berhasil dikeluarkan. Silakan coba lagi.');
    }
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
        <Text style={[s.sectionKicker, { color: c.primary }]}>AKUN</Text>
        <Text style={[s.sectionTitle, { color: c.foreground }]}>Akun Kasir Miso</Text>
        <Text style={[s.sectionBody, { color: c.mutedForeground }]}>
          Kelola login dan logout dari satu halaman ini.
        </Text>
        <Surface style={s.accountCard}>
          {!isAuthLoaded ? (
            <Text style={[s.accountStatus, { color: c.mutedForeground }]}>Memeriksa status akun...</Text>
          ) : isSignedIn ? (
            <>
              <View style={s.accountIdentity}>
                <View style={[s.accountIcon, { backgroundColor: c.secondary }]}>
                  <Ionicons name="person-circle-outline" size={25} color={c.primary} />
                </View>
                <View style={s.settingCopy}>
                  <Text style={[s.settingLabel, { color: c.foreground }]}>
                    {user?.fullName || 'Akun aktif'}
                  </Text>
                  <Text style={[s.settingDetail, { color: c.mutedForeground }]}>
                    {user?.primaryEmailAddress?.emailAddress || 'Sesi Kasir Miso aktif'}
                  </Text>
                </View>
              </View>
              <Pressable
                testID="settings-sign-out-button"
                accessibilityRole="button"
                accessibilityLabel="Keluar dari akun Kasir Miso"
                onPress={() => void handleSignOut()}
                style={({ pressed }) => [
                  s.signOutButton,
                  { borderColor: c.border, opacity: pressed ? 0.68 : 1 },
                ]}
              >
                <Ionicons name="log-out-outline" size={18} color={c.destructive} />
                <Text style={[s.signOutText, { color: c.destructive }]}>Keluar dari akun</Text>
              </Pressable>
            </>
          ) : (
            <PrimaryButton
              testID="settings-sign-in-button"
              icon="log-in-outline"
              onPress={() => router.push('/sign-in')}
            >
              Masuk ke akun
            </PrimaryButton>
          )}
        </Surface>
        {accountNotice ? (
          <Text style={[s.accountNotice, { color: c.mutedForeground }]}>{accountNotice}</Text>
        ) : null}
      </View>

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
  savedNotice: { minHeight: 44, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  savedNoticeText: { flex: 1, fontSize: 11, fontWeight: '700', lineHeight: 16 },
  accountCard: { gap: 13 },
  accountStatus: { fontSize: 13, fontWeight: '700' },
  accountIdentity: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  accountIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  signOutButton: { minHeight: 46, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  signOutText: { fontSize: 13, fontWeight: '800' },
  accountNotice: { fontSize: 11, lineHeight: 16, marginTop: 7 },
});