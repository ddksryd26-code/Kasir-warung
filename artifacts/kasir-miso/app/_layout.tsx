import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkLoaded, ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as Font from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { WarungProvider } from '@/context/WarungContext';
import { NotesProvider } from '@/context/NotesContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { FirstLaunchTutorial } from '@/components/FirstLaunchTutorial';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';

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
      <FirstLaunchTutorial />
    </>
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
