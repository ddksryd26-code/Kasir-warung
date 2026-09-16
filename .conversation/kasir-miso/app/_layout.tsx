import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

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

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
