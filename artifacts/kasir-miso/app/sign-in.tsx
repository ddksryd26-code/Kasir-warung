import React, { useCallback, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useSignIn, useSSO } from '@clerk/expo';
import { useSignInWithGoogle } from '@clerk/expo/google';
import { type Href, useRouter } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

WebBrowser.maybeCompleteAuthSession();

function getClerkErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object') {
    const candidate = error as { longMessage?: unknown; message?: unknown };
    if (typeof candidate.longMessage === 'string' && candidate.longMessage.trim()) return candidate.longMessage;
    if (typeof candidate.message === 'string' && candidate.message.trim()) return candidate.message;
  }
  return fallback;
}

function getClerkErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return '';
  const candidate = error as { code?: unknown; errors?: Array<{ code?: unknown }> };
  if (typeof candidate.code === 'string') return candidate.code;
  const firstErrorCode = candidate.errors?.find((item) => typeof item?.code === 'string')?.code;
  return typeof firstErrorCode === 'string' ? firstErrorCode : '';
}

function isMissingAccountError(error: unknown) {
  const code = getClerkErrorCode(error);
  const message = getClerkErrorMessage(error, '').toLowerCase();
  return (
    code === 'form_identifier_not_found' ||
    code === 'identifier_not_found' ||
    message.includes("couldn't find your account") ||
    message.includes('could not find your account') ||
    message.includes('account not found')
  );
}

export default function SignInScreen() {
  if (!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <SignInUnavailableScreen />;
  }

  return <ClerkSignInScreen />;
}

function ClerkSignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const { startGoogleAuthenticationFlow } = useSignInWithGoogle();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isPasswordSigningIn, setIsPasswordSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const isBusy = isGoogleSigningIn || isPasswordSigningIn || fetchStatus === 'fetching';

  const finishSignIn = useCallback(async () => {
    await signIn.finalize();
    router.replace('/(tabs)/other' as Href);
  }, [router, signIn]);

  const handlePasswordSignIn = useCallback(async () => {
    setErrorMessage('');
    setIsPasswordSigningIn(true);

    try {
      const result = await signIn.password({
        emailAddress: emailAddress.trim(),
        password,
      });

      if (result.error) {
        setErrorMessage(
          isMissingAccountError(result.error)
            ? 'Akun ini belum terdaftar di environment Clerk pada build ini. Pilih “Buat akun” atau gunakan build/environment yang sama dengan saat akun dibuat.'
            : getClerkErrorMessage(result.error, 'Email atau password belum benar.'),
        );
        return;
      }

      if (signIn.status === 'complete') {
        await finishSignIn();
        return;
      }

      if (signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust') {
        setErrorMessage('Akun ini membutuhkan verifikasi tambahan. Selesaikan verifikasi lalu coba lagi.');
        return;
      }

      setErrorMessage('Login belum selesai. Silakan periksa data lalu coba lagi.');
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error, 'Login gagal. Silakan coba lagi.'));
    } finally {
      setIsPasswordSigningIn(false);
    }
  }, [emailAddress, finishSignIn, password, signIn]);

  const handleGoogleSignIn = useCallback(async () => {
    setErrorMessage('');
    setIsGoogleSigningIn(true);

    try {
      if (Platform.OS !== 'web') {
        const { createdSessionId, setActive } = await startGoogleAuthenticationFlow();

        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          router.replace('/(tabs)/other' as Href);
        } else {
          setErrorMessage('Login Google belum selesai. Silakan pilih akun lalu coba lagi.');
        }
        return;
      }

      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri({ path: 'sign-in' }),
      });

      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: async ({ session, decorateUrl }) => {
            if (session?.currentTask) {
              setErrorMessage('Akun memerlukan langkah tambahan sebelum bisa digunakan.');
              return;
            }
            router.replace(decorateUrl('/(tabs)/other') as Href);
          },
        });
      } else {
        setErrorMessage('Login Google belum selesai. Silakan coba lagi.');
      }
    } catch (error) {
      const message = getClerkErrorMessage(error, '');
      const normalizedMessage = message.toLowerCase();
      if (normalizedMessage.includes('credentials not found')) {
        setErrorMessage(
          'Google belum ikut terbawa ke build ini. Build ulang setelah EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID tersedia di environment build.',
        );
      } else if (normalizedMessage.includes('developer_error') || normalizedMessage.includes('10:')) {
        setErrorMessage(
          'Konfigurasi OAuth Google tidak cocok dengan package atau signing certificate build ini. Periksa Android Client ID dan SHA-1 release.',
        );
      } else {
        setErrorMessage(message || 'Login Google dibatalkan atau gagal. Silakan coba lagi.');
      }
    } finally {
      setIsGoogleSigningIn(false);
    }
  }, [router, startGoogleAuthenticationFlow, startSSOFlow]);

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 }}
      bottomOffset={28}
    >
      <View style={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, { backgroundColor: colors.muted, opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>

        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Ionicons name="storefront-outline" size={34} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.kicker, { color: colors.primary }]}>AKUN KASIR MISO</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Masuk ke akunmu</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Simpan akses akun warungmu dengan aman dan lanjutkan dari perangkat mana pun.
        </Text>

        <Pressable
          testID="google-sign-in-button"
          accessibilityRole="button"
          accessibilityLabel="Masuk dengan Google"
          disabled={isBusy}
          onPress={() => void handleGoogleSignIn()}
          style={({ pressed }) => [
            styles.googleButton,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed || isBusy ? 0.62 : 1 },
          ]}
        >
          {isGoogleSigningIn ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Ionicons name="logo-google" size={20} color={colors.primary} />
          )}
          <Text style={[styles.googleButtonText, { color: colors.foreground }]}>
            {isGoogleSigningIn ? 'Menyiapkan Google...' : 'Lanjutkan dengan Google'}
          </Text>
        </Pressable>

        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>atau email</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
        <TextInput
          testID="email-sign-in-input"
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
        {errors.fields?.identifier?.message ? (
          <Text style={[styles.fieldError, { color: colors.destructive }]}>{errors.fields.identifier.message}</Text>
        ) : null}

        <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
        <TextInput
          testID="password-sign-in-input"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Masukkan password"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        />
        {errors.fields?.password?.message ? (
          <Text style={[styles.fieldError, { color: colors.destructive }]}>{errors.fields.password.message}</Text>
        ) : null}

        <Pressable
          testID="password-sign-in-button"
          accessibilityRole="button"
          disabled={isBusy || !emailAddress.trim() || !password}
          onPress={() => void handlePasswordSignIn()}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary, opacity: pressed || isBusy || !emailAddress.trim() || !password ? 0.62 : 1 },
          ]}
        >
          {isPasswordSigningIn ? <ActivityIndicator color={colors.primaryForeground} /> : null}
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
            {isPasswordSigningIn ? 'Memeriksa...' : 'Masuk dengan email'}
          </Text>
        </Pressable>

        {errorMessage ? (
          <View style={[styles.errorBox, { backgroundColor: colors.secondary }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.secondaryForeground }]}>{errorMessage}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buat akun baru"
          onPress={() => router.push('/sign-up' as Href)}
          style={({ pressed }) => [styles.signUpLink, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.signUpText, { color: colors.mutedForeground }]}>
            Belum punya akun? <Text style={{ color: colors.primary, fontWeight: '800' }}>Buat akun</Text>
          </Text>
        </Pressable>

        <Text style={[styles.privacy, { color: colors.mutedForeground }]}>
          Dengan masuk, kamu menyetujui penggunaan akun untuk mengamankan akses aplikasi.
        </Text>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

function SignInUnavailableScreen() {
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
        <Text style={[styles.title, { color: colors.foreground }]}>Login belum tersedia</Text>
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
  googleButton: { minHeight: 56, width: '100%', maxWidth: 360, borderWidth: 1, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 28 },
  googleButtonText: { fontSize: 15, fontWeight: '800' },
  divider: { width: '100%', maxWidth: 360, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22, marginBottom: 4 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '700' },
  label: { width: '100%', maxWidth: 360, fontSize: 12, fontWeight: '800', marginTop: 14, marginBottom: 7 },
  input: { width: '100%', maxWidth: 360, minHeight: 52, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, fontSize: 15 },
  fieldError: { width: '100%', maxWidth: 360, fontSize: 11, lineHeight: 16, marginTop: 5 },
  primaryButton: { width: '100%', maxWidth: 360, minHeight: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 },
  primaryButtonText: { fontSize: 14, fontWeight: '800' },
  errorBox: { width: '100%', maxWidth: 360, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, marginTop: 14 },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  signUpLink: { marginTop: 18, paddingVertical: 6 },
  signUpText: { fontSize: 13 },
  privacy: { maxWidth: 320, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 16 },
});