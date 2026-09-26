import React, { useCallback, useState } from 'react';
import { useAuth, useSignUp } from '@clerk/expo';
import { type Href, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

function getClerkErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object') {
    const candidate = error as { longMessage?: unknown; message?: unknown };
    if (typeof candidate.longMessage === 'string' && candidate.longMessage.trim()) return candidate.longMessage;
    if (typeof candidate.message === 'string' && candidate.message.trim()) return candidate.message;
  }
  return fallback;
}

export default function SignUpScreen() {
  if (!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <SignUpUnavailableScreen />;
  }

  return <ClerkSignUpScreen />;
}

function ClerkSignUpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { signUp, errors, fetchStatus } = useSignUp();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [isVerificationStep, setIsVerificationStep] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const isBusy = fetchStatus === 'fetching';

  const finishSignUp = useCallback(async () => {
    await signUp.finalize();
    router.replace('/(tabs)/other' as Href);
  }, [router, signUp]);

  const handleCreateAccount = useCallback(async () => {
    setErrorMessage('');

    try {
      const result = await signUp.password({
        emailAddress: emailAddress.trim(),
        password,
      });

      if (result.error) {
        setErrorMessage(getClerkErrorMessage(result.error, 'Akun belum bisa dibuat. Periksa data yang dimasukkan.'));
        return;
      }

      if (signUp.status === 'complete') {
        await finishSignUp();
        return;
      }

      await signUp.verifications.sendEmailCode();
      setIsVerificationStep(true);
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error, 'Akun belum bisa dibuat. Silakan coba lagi.'));
    }
  }, [emailAddress, finishSignUp, password, signUp]);

  const handleVerifyEmail = useCallback(async () => {
    setErrorMessage('');

    try {
      await signUp.verifications.verifyEmailCode({ code: code.trim() });

      if (signUp.status === 'complete') {
        await finishSignUp();
        return;
      }

      setErrorMessage('Verifikasi belum selesai. Silakan periksa kode email dan coba lagi.');
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error, 'Kode verifikasi salah atau sudah kedaluwarsa.'));
    }
  }, [code, finishSignUp, signUp]);

  if (isSignedIn) return null;

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 }}
      bottomOffset={28}
    >
      <View style={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali ke login"
          onPress={() => router.replace('/sign-in' as Href)}
          style={({ pressed }) => [styles.backButton, { backgroundColor: colors.muted, opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>

        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Ionicons name="person-add-outline" size={34} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.kicker, { color: colors.primary }]}>AKUN KASIR MISO</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {isVerificationStep ? 'Verifikasi email' : 'Buat akun baru'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {isVerificationStep
            ? `Kode verifikasi sudah dikirim ke ${emailAddress}.`
            : 'Buat akun untuk menyimpan data warung dan mengaksesnya dari perangkat lain.'}
        </Text>

        {isVerificationStep ? (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>Kode verifikasi</Text>
            <TextInput
              testID="email-verification-input"
              autoCapitalize="none"
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
              placeholder="Masukkan kode dari email"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
            {errors.fields?.code?.message ? (
              <Text style={[styles.fieldError, { color: colors.destructive }]}>{errors.fields.code.message}</Text>
            ) : null}
            <Pressable
              testID="verify-email-button"
              accessibilityRole="button"
              disabled={isBusy || !code.trim()}
              onPress={() => void handleVerifyEmail()}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.primary, opacity: pressed || isBusy || !code.trim() ? 0.62 : 1 },
              ]}
            >
              {isBusy ? <ActivityIndicator color={colors.primaryForeground} /> : null}
              <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                {isBusy ? 'Memverifikasi...' : 'Verifikasi email'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => void signUp.verifications.sendEmailCode()}
              style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border, opacity: pressed || isBusy ? 0.62 : 1 }]}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>Kirim ulang kode</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
            <TextInput
              testID="email-sign-up-input"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              value={emailAddress}
              onChangeText={setEmailAddress}
              placeholder="nama@email.com"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
            {errors.fields?.emailAddress?.message ? (
              <Text style={[styles.fieldError, { color: colors.destructive }]}>{errors.fields.emailAddress.message}</Text>
            ) : null}

            <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
            <TextInput
              testID="password-sign-up-input"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Minimal sesuai aturan akun"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
            {errors.fields?.password?.message ? (
              <Text style={[styles.fieldError, { color: colors.destructive }]}>{errors.fields.password.message}</Text>
            ) : null}

            <View nativeID="clerk-captcha" />
            <Pressable
              testID="create-account-button"
              accessibilityRole="button"
              disabled={isBusy || !emailAddress.trim() || !password}
              onPress={() => void handleCreateAccount()}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.primary, opacity: pressed || isBusy || !emailAddress.trim() || !password ? 0.62 : 1 },
              ]}
            >
              {isBusy ? <ActivityIndicator color={colors.primaryForeground} /> : null}
              <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                {isBusy ? 'Membuat akun...' : 'Buat akun'}
              </Text>
            </Pressable>
          </>
        )}

        {errorMessage ? (
          <View style={[styles.errorBox, { backgroundColor: colors.secondary }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.secondaryForeground }]}>{errorMessage}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/sign-in' as Href)}
          style={({ pressed }) => [styles.signInLink, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.signInText, { color: colors.mutedForeground }]}>
            Sudah punya akun? <Text style={{ color: colors.primary, fontWeight: '800' }}>Masuk</Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

function SignUpUnavailableScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 20 }]}>
      <View style={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, { backgroundColor: colors.muted, opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>
        <View style={[styles.logo, { backgroundColor: colors.muted }]}>
          <Ionicons name="shield-outline" size={34} color={colors.mutedForeground} />
        </View>
        <Text style={[styles.kicker, { color: colors.primary }]}>AKUN KASIR MISO</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Pendaftaran belum tersedia</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Konfigurasi login belum masuk ke build ini. Tambahkan environment Clerk sebelum membuat build Expo.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, alignItems: 'center' },
  backButton: { alignSelf: 'flex-start', width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 76, height: 76, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginTop: 40, marginBottom: 20 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { fontSize: 29, fontWeight: '800', textAlign: 'center', marginTop: 9 },
  subtitle: { fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 320, marginTop: 10 },
  label: { width: '100%', maxWidth: 360, fontSize: 12, fontWeight: '800', marginTop: 22, marginBottom: 7 },
  input: { width: '100%', maxWidth: 360, minHeight: 52, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, fontSize: 15 },
  fieldError: { width: '100%', maxWidth: 360, fontSize: 11, lineHeight: 16, marginTop: 5 },
  primaryButton: { width: '100%', maxWidth: 360, minHeight: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  primaryButtonText: { fontSize: 14, fontWeight: '800' },
  secondaryButton: { width: '100%', maxWidth: 360, minHeight: 50, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryButtonText: { fontSize: 13, fontWeight: '800' },
  errorBox: { width: '100%', maxWidth: 360, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, marginTop: 14 },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  signInLink: { marginTop: 20, paddingVertical: 6 },
  signInText: { fontSize: 13 },
});