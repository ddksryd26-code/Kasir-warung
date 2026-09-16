import React, { useEffect } from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NotesScreen from '../app/(tabs)/notes';
import { NotesProvider } from '@/context/NotesContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { WarungProvider, useWarung } from '@/context/WarungContext';

vi.mock('react-native', async () => {
  const React = await import('react');
  const component = (name: string) => (props: { children?: React.ReactNode; [key: string]: unknown }) => (
    React.createElement(name, props, props.children)
  );
  return {
    Alert: { alert: vi.fn() },
    Modal: component('Modal'),
    Platform: { OS: 'web' },
    Pressable: component('Pressable'),
    ScrollView: component('ScrollView'),
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: component('Text'),
    TextInput: component('TextInput'),
    View: component('View'),
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(
      key === 'kasir-miso-notes-v1'
        ? JSON.stringify({
          shoppingToday: [{
            id: 'shopping-1',
            text: 'Beras',
            done: false,
            createdAt: '2026-09-09T08:00:00.000Z',
            quantity: 1,
            unit: 'pack',
          }],
          shoppingTomorrow: [],
          carry: [],
          general: [],
        })
        : null,
    )),
    setItem: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('@/utils/persistentImage', () => ({
  persistImageUri: async (uri: string) => uri,
}));

vi.mock('@/components/KeyboardAwareScrollViewCompat', () => ({
  KeyboardAwareScrollViewCompat: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    React.createElement('ScrollView', props, children)
  ),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: (props: Record<string, unknown>) => React.createElement('Icon', props),
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('react-native-keyboard-controller', () => ({
  KeyboardAwareScrollView: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    React.createElement('KeyboardAwareScrollView', props, children)
  ),
}));

function ExpenseProbe() {
  const { expenses } = useWarung();
  return React.createElement('ExpenseProbe', { testID: 'expense-count', count: expenses.length });
}

function TestApp() {
  return (
    <ThemeProvider>
      <WarungProvider>
        <NotesProvider>
          <NotesScreen />
          <ExpenseProbe />
        </NotesProvider>
      </WarungProvider>
    </ThemeProvider>
  );
}

async function renderNotes() {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<TestApp />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    renderer.root.findByProps({ testID: 'shopping-day-today' }).props.onPress();
  });
  return renderer;
}

function expenseCount(renderer: ReactTestRenderer) {
  return renderer.root.findByProps({ testID: 'expense-count' }).props.count as number;
}

function shoppingCheckbox(renderer: ReactTestRenderer, done = false) {
  return renderer.root.findByProps({
    accessibilityLabel: done ? 'Tandai Beras belum dibeli' : 'Tandai Beras sudah dibeli',
  });
}

describe('NotesScreen shopping flow', () => {
  const alertSpy = vi.spyOn(Alert, 'alert').mockImplementation(() => undefined);

  beforeEach(() => {
    alertSpy.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects completing a today item until its price is entered', async () => {
    const renderer = await renderNotes();

    await act(async () => {
      shoppingCheckbox(renderer).props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Harga belum diisi',
      'Masukkan total harga belanja sebelum menandai barang sudah dibeli.',
    );
    expect(shoppingCheckbox(renderer).props.accessibilityState.checked).toBe(false);
    expect(expenseCount(renderer)).toBe(0);
  });

  it('records one expense when a priced item is completed, cancelled, and completed again', async () => {
    const renderer = await renderNotes();
    const priceInput = renderer.root.findByProps({ accessibilityLabel: 'Total harga Beras' });

    await act(async () => {
      priceInput.props.onChangeText('25000');
    });
    await act(async () => {
      shoppingCheckbox(renderer).props.onPress();
    });
    await act(async () => {
      shoppingCheckbox(renderer, true).props.onPress();
    });
    await act(async () => {
      shoppingCheckbox(renderer).props.onPress();
    });

    expect(expenseCount(renderer)).toBe(1);
    expect(shoppingCheckbox(renderer, true).props.accessibilityState.checked).toBe(true);
  });

  it('does not duplicate the expense when completion is clicked twice quickly', async () => {
    const renderer = await renderNotes();
    const priceInput = renderer.root.findByProps({ accessibilityLabel: 'Total harga Beras' });

    await act(async () => {
      priceInput.props.onChangeText('25000');
    });
    const checkbox = shoppingCheckbox(renderer);

    await act(async () => {
      checkbox.props.onPress();
      checkbox.props.onPress();
    });

    expect(expenseCount(renderer)).toBe(1);
  });
});