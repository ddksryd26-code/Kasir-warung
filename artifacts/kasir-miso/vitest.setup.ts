import { vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  AppState: { addEventListener: () => ({ remove: () => undefined }) },
  Alert: { alert: vi.fn() },
  Modal: 'Modal',
  Platform: { OS: 'web' },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));

vi.mock('@clerk/expo', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: Boolean((globalThis as { __kasirMisoUserId?: string | null }).__kasirMisoUserId),
    userId: (globalThis as { __kasirMisoUserId?: string | null }).__kasirMisoUserId ?? null,
  }),
}));

vi.mock('@/utils/persistentImage', () => ({
  persistImageUri: async (uri: string | undefined) => uri,
}));