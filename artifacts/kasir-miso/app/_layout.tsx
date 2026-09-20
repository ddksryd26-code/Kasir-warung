import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkLoaded, ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as Font from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { WarungProvider } from '@/context/WarungContext';
import { NotesProvider } from '@/context/NotesContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { FirstLaunchTutorial } from '@/components/FirstLaunchTutorial';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useWarung } from '@/context/WarungContext';
import { Ionicons } from '@expo/vector-icons';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
const clerkProxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;
const apiDomain = process.env.EXPO_PUBLIC_DOMAIN;

if (apiDomain) {
  setBaseUrl(`https://${apiDomain}`);
}

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function RootLayoutNav() {
  return (
    <>
      <Stack screenOptions={{ headerBackTitle: 'Back' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="business-card" options={{ headerShown: false }} />
        <Stack.Screen name="business-profile" options={{ headerShown: false }} />
        <Stack.Screen name="staff" options={{ headerShown: false }} />
        <Stack.Screen name="reminders" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="stock-edit" options={{ headerShown: false }} />
        <Stack.Screen name="cash-flow" options={{ headerShown: false }} />
      </Stack>
      <SyncConflictPrompt />
      <FirstLaunchTutorial />
    </>
  );
}

function SyncConflictPrompt() {
  const c = useColors();
  const { syncConflict, resolveSyncConflict } = useWarung();
  const [pendingChoice, setPendingChoice] = useState<'local' | 'remote' | 'merge' | null>(null);

  if (!syncConflict) return null;

  const resolve = async (choice: 'local' | 'remote' | 'merge') => {
    setPendingChoice(choice);
    try {
      await resolveSyncConflict(choice);
    } finally {
      setPendingChoice(null);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={[syncStyles.backdrop, { backgroundColor: c.foreground + 'B8' }]}>
        <View style={[syncStyles.card, { backgroundColor: c.card }]}>
          <View style={[syncStyles.icon, { backgroundColor: c.secondary }]}>
            <Ionicons name="git-compare-outline" size={25} color={c.primary} />
          </View>
          <Text style={[syncStyles.kicker, { color: c.primary }]}>PERUBAHAN DI PERANGKAT LAIN</Text>
          <Text style={[syncStyles.title, { color: c.foreground }]}>Data warung perlu dipilih</Text>
          <Text style={[syncStyles.body, { color: c.mutedForeground }]}>
            Ada perubahan dari perangkat lain sejak perangkat ini terakhir tersinkronisasi.
            Pilih cara menyelesaikannya agar data tidak tertimpa diam-diam.
          </Text>
          <View style={[syncStyles.info, { backgroundColor: c.secondary }]}>
            <Ionicons name="shield-checkmark-outline" size={18} color={c.primary} />
            <Text style={[syncStyles.infoText, { color: c.secondaryForeground }]}>
              Versi cloud terakhir: {syncConflict.remoteVersion}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={pendingChoice !== null}
            onPress={() => void resolve('merge')}
            style={({ pressed }) => [
              syncStyles.primaryButton,
              { backgroundColor: c.primary, opacity: pressed || pendingChoice ? 0.7 : 1 },
            ]}
          >
            {pendingChoice === 'merge' ? <ActivityIndicator color={c.primaryForeground} /> : <Ionicons name="git-merge-outline" size={18} color={c.primaryForeground} />}
            <Text style={[syncStyles.primaryButtonText, { color: c.primaryForeground }]}>Gabungkan data</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={pendingChoice !== null}
            onPress={() => void resolve('local')}
            style={({ pressed }) => [
              syncStyles.secondaryButton,
              { borderColor: c.border, backgroundColor: c.card, opacity: pressed || pendingChoice ? 0.7 : 1 },
            ]}
          >
            {pendingChoice === 'local' ? <ActivityIndicator color={c.foreground} /> : <Ionicons name="phone-portrait-outline" size={18} color={c.foreground} />}
            <Text style={[syncStyles.secondaryButtonText, { color: c.foreground }]}>Pertahankan perangkat ini</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={pendingChoice !== null}
            onPress={() => void resolve('remote')}
            style={({ pressed }) => [
              syncStyles.secondaryButton,
              { borderColor: c.border, backgroundColor: c.card, opacity: pressed || pendingChoice ? 0.7 : 1 },
            ]}
          >
            {pendingChoice === 'remote' ? <ActivityIndicator color={c.foreground} /> : <Ionicons name="cloud-download-outline" size={18} color={c.foreground} />}
            <Text style={[syncStyles.secondaryButtonText, { color: c.foreground }]}>Gunakan data cloud</Text>
          </Pressable>
          {Platform.OS === 'web' ? <View style={syncStyles.webBottomInset} /> : null}
        </View>
      </View>
    </Modal>
  );
}

function ClerkApiBridge({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  return children;
}

function AppProviders({ withClerk }: { withClerk: boolean }) {
  const app = (
    <ThemeProvider>
      <ErrorBoundary>
        <WarungProvider>
          <NotesProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </NotesProvider>
        </WarungProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );

  return withClerk ? <ClerkApiBridge>{app}</ClerkApiBridge> : app;
}

const syncStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 430, alignSelf: 'center', borderRadius: 26, padding: 22 },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 23, fontWeight: '800', marginTop: 5 },
  body: { fontSize: 13, lineHeight: 19, marginTop: 10 },
  info: { borderRadius: 13, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 14 },
  infoText: { fontSize: 12, fontWeight: '700' },
  primaryButton: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 8 },
  primaryButtonText: { fontSize: 13, fontWeight: '800' },
  secondaryButton: { minHeight: 48, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 8 },
  secondaryButtonText: { fontSize: 12, fontWeight: '800' },
  webBottomInset: { height: 10 },
});

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [fontError, setFontError] = useState<Error | null>(null);

  useEffect(() => {
    // Web can render with the system fallback while the optional Inter font
    // loads. Blocking the entire router on web font loading can leave a
    // permanently blank preview when the asset request never settles.
    if (Platform.OS === 'web') {
      setFontsLoaded(true);
      return;
    }

    let active = true;
    const timeout = setTimeout(() => {
      if (active) {
        setFontError(new Error('Font loading timed out'));
      }
    }, 4000);

    Font.loadAsync({
      Inter_400Regular,
      Inter_500Medium,
      Inter_600SemiBold,
      Inter_700Bold,
    })
      .then(() => {
        if (active) setFontsLoaded(true);
      })
      .catch((error: Error) => {
        if (active) setFontError(error);
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  const app = (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppProviders withClerk={Boolean(clerkPublishableKey)} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );

  if (!clerkPublishableKey) return app;

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      tokenCache={tokenCache}
      proxyUrl={clerkProxyUrl}
    >
      <ClerkLoaded>{app}</ClerkLoaded>
    </ClerkProvider>
  );
}
