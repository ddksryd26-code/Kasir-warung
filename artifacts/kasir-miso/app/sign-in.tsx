import React, { useCallback, useEffect, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useSSO } from '@clerk/expo';
import { type Href, useRouter } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { startSSOFlow } = useSSO();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useWarmUpBrowser();

  const handleGoogleSignIn = useCallback(async () => {
    setErrorMessage('');
    setIsSigningIn(true);

    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri({
          scheme: 'com.kasirwarung.app',
          path: 'sign-in',
        }),
      });

      if (createdSessionId) {
        await setActive?.({
          session: createdSessionId,
          navigate: async ({ session, decorateUrl }) => {
            if (session?.currentTask) {
              setErrorMessage('Akun memerlukan langkah tambahan sebelum bisa digunakan.');
              return;
            }
            router.replace(decorateUrl('/other') as Href);
          },
        });
      } else {
        setErrorMessage('Login belum selesai. Silakan coba lagi.');
      }
    } catch {
      setErrorMessage('Login Google dibatalkan atau gagal. Silakan coba lagi.');
    } finally {
      setIsSigningIn(false);
    }
  }, [router, startSSOFlow]);

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
          disabled={isSigningIn}
          onPress={() => void handleGoogleSignIn()}
          style={({ pressed }) => [
            styles.googleButton,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed || isSigningIn ? 0.62 : 1 },
          ]}
        >
          {isSigningIn ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Ionicons name="logo-google" size={20} color={colors.primary} />
          )}
          <Text style={[styles.googleButtonText, { color: colors.foreground }]}>
            {isSigningIn ? 'Membuka Google...' : 'Lanjutkan dengan Google'}
          </Text>
        </Pressable>

        {errorMessage ? (
          <View style={[styles.errorBox, { backgroundColor: colors.secondary }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.secondaryForeground }]}>{errorMessage}</Text>
          </View>
        ) : null}

        <Text style={[styles.privacy, { color: colors.mutedForeground }]}>
          Dengan masuk, kamu menyetujui penggunaan akun Google untuk mengamankan akses aplikasi.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, alignItems: 'center' },
  backButton: { alignSelf: 'flex-start', width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 76, height: 76, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginTop: 58, marginBottom: 20 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { fontSize: 29, fontWeight: '800', textAlign: 'center', marginTop: 9 },
  subtitle: { fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 320, marginTop: 10 },
  googleButton: { minHeight: 56, width: '100%', maxWidth: 360, borderWidth: 1, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 34 },
  googleButtonText: { fontSize: 15, fontWeight: '800' },
  errorBox: { width: '100%', maxWidth: 360, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, marginTop: 14 },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  privacy: { maxWidth: 320, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 22 },
});