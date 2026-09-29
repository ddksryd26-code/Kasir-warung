import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signedIn: true,
  driveRequest: { codeVerifier: 'test-code-verifier' },
  driveResponse: null as unknown,
  driveConnection: {
    data: { connected: false, email: null, connectedAt: null },
    isPending: false,
    isFetching: false,
    isFetched: true,
  },
  driveBackups: { data: { backups: [] } },
  promptDriveAsync: vi.fn(),
  connectMutation: {
    isPending: false,
    mutate: vi.fn(),
  },
  disconnectMutation: {
    isPending: false,
    mutate: vi.fn(),
  },
  backupMutation: {
    data: undefined,
    isPending: false,
    mutateAsync: vi.fn(),
  },
  restoreDriveBackup: vi.fn(),
  warung: {
    hydrated: false,
    menus: [],
    activeOrders: [],
    kitchenOrders: [],
    inventory: [],
    stockMovements: [],
    consignments: [],
    expenses: [],
    sales: [],
    auditTrail: [],
    cashClosures: [],
    savingsRules: [],
    savingsEntries: [],
    qrisImageUri: undefined,
    restoreState: vi.fn(),
  },
}));

vi.mock('expo-auth-session', () => ({
  makeRedirectUri: vi.fn(() => 'kasir-miso://drive-callback'),
  ResponseType: { Code: 'code' },
}));

vi.mock('expo-auth-session/providers/google', () => ({
  useAuthRequest: () => [
    mocks.driveRequest,
    mocks.driveResponse,
    mocks.promptDriveAsync,
  ],
}));

vi.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: vi.fn(),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

vi.mock('@/components/WarungUI', async () => {
  const React = await import('react');
  const passthrough = (name: string) => (props: { children?: React.ReactNode; [key: string]: unknown }) => (
    React.createElement(name, props, props.children)
  );
  return {
    PrimaryButton: passthrough('PrimaryButton'),
    Surface: passthrough('Surface'),
  };
});

vi.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    primary: '#D95D39',
    primaryForeground: '#FFFFFF',
    foreground: '#1F2937',
    mutedForeground: '#6B7280',
    secondary: '#FDE8E1',
    secondaryForeground: '#7C2D12',
    card: '#FFFFFF',
    border: '#E5E7EB',
    destructive: '#B91C1C',
    muted: '#F3F4F6',
  }),
}));

vi.mock('@/context/WarungContext', () => ({
  useWarung: () => mocks.warung,
}));

vi.mock('@/utils/persistentImage', () => ({
  mimeTypeFromUri: vi.fn(() => 'image/jpeg'),
  persistImageBase64: vi.fn(async (base64: string, mimeType: string) => `data:${mimeType};base64,${base64}`),
  readImageAsBase64: vi.fn(),
}));

vi.mock('@workspace/api-client-react', () => ({
  getDriveImage: vi.fn(),
  getGetDriveConnectionQueryKey: () => ['drive-connection'],
  getListDriveBackupsQueryKey: () => ['drive-backups'],
  restoreDriveBackup: mocks.restoreDriveBackup,
  uploadDriveImage: vi.fn(),
  useConnectDrive: () => mocks.connectMutation,
  useDisconnectDrive: () => mocks.disconnectMutation,
  useGetDriveConnection: () => mocks.driveConnection,
  useListDriveBackups: () => mocks.driveBackups,
  useSaveDriveBackup: () => mocks.backupMutation,
}));

import { GoogleDriveBackupCard } from './GoogleDriveBackupCard';

type AuthResponse =
  | { type: 'success'; params: { code: string } }
  | { type: 'cancel' }
  | { type: 'dismiss' }
  | { type: 'error'; error?: string };

function createTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function cardElement() {
  return (
    <GoogleDriveBackupCard
      isAuthLoaded
      isSignedIn={mocks.signedIn}
      onRequestSignIn={vi.fn()}
    />
  );
}

async function renderCard(client = createTestClient()) {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        {cardElement()}
      </QueryClientProvider>,
    );
    await Promise.resolve();
  });
  return { renderer, client };
}

async function updateCard(renderer: ReactTestRenderer) {
  await act(async () => {
    renderer.update(
      <QueryClientProvider client={renderer.root.findByType(QueryClientProvider).props.client}>
        {cardElement()}
      </QueryClientProvider>,
    );
    await Promise.resolve();
  });
}

function renderedText(renderer: ReactTestRenderer) {
  return renderer.root
    .findAllByType('Text')
    .flatMap((node) => node.children)
    .filter((child): child is string => typeof child === 'string')
    .join(' ');
}

describe('GoogleDriveBackupCard automatic connection', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID = 'test-google-client-id';
    mocks.signedIn = true;
    mocks.driveRequest = { codeVerifier: 'test-code-verifier' };
    mocks.driveResponse = null;
    mocks.driveConnection = {
      data: { connected: false, email: null, connectedAt: null },
      isPending: false,
      isFetching: false,
      isFetched: true,
    };
    mocks.promptDriveAsync.mockReset();
    mocks.promptDriveAsync.mockResolvedValue({ type: 'opened' });
    mocks.connectMutation.isPending = false;
    mocks.connectMutation.mutate.mockReset();
    mocks.disconnectMutation.mutate.mockReset();
    mocks.backupMutation.mutateAsync.mockReset();
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
  });

  it('opens the Google Drive prompt automatically after a signed-in session has no connection', async () => {
    await renderCard();

    expect(mocks.promptDriveAsync).toHaveBeenCalledTimes(1);
  });

  it('keeps the cancellation state visible and does not exchange an OAuth code', async () => {
    mocks.promptDriveAsync.mockResolvedValue({ type: 'cancel' });

    const { renderer } = await renderCard();

    expect(mocks.connectMutation.mutate).not.toHaveBeenCalled();
    expect(renderedText(renderer)).toContain('Login Google Drive dibatalkan atau gagal.');
  });

  it('exchanges a successful callback once and ignores a duplicate callback', async () => {
    const { renderer } = await renderCard();
    mocks.driveResponse = {
      type: 'success',
      params: { code: 'oauth-code-1' },
    } satisfies AuthResponse;

    await updateCard(renderer);
    await updateCard(renderer);

    expect(mocks.connectMutation.mutate).toHaveBeenCalledTimes(1);
    expect(mocks.connectMutation.mutate).toHaveBeenCalledWith({
      data: {
        code: 'oauth-code-1',
        redirectUri: 'kasir-miso://drive-callback',
        codeVerifier: 'test-code-verifier',
      },
    });
  });

  it('does not exchange an OAuth callback that arrives after logout', async () => {
    const { renderer } = await renderCard();
    mocks.signedIn = false;
    await updateCard(renderer);

    mocks.driveResponse = {
      type: 'success',
      params: { code: 'late-oauth-code' },
    } satisfies AuthResponse;
    await updateCard(renderer);

    expect(mocks.connectMutation.mutate).not.toHaveBeenCalled();
  });

  it('clears the old connection cache and auto-connects again after login', async () => {
    const { renderer, client } = await renderCard();
    client.setQueryData(['drive-connection'], {
      connected: true,
      email: 'old-account@example.com',
      connectedAt: '2026-09-29T00:00:00.000Z',
    });

    mocks.signedIn = false;
    await updateCard(renderer);
    expect(client.getQueryData(['drive-connection'])).toBeUndefined();

    mocks.signedIn = true;
    mocks.driveConnection = {
      data: { connected: false, email: null, connectedAt: null },
      isPending: false,
      isFetching: false,
      isFetched: true,
    };
    await updateCard(renderer);

    expect(mocks.promptDriveAsync).toHaveBeenCalledTimes(2);
  });
});