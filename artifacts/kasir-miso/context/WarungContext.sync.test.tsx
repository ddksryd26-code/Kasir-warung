import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getWarungState, saveWarungState } from '@workspace/api-client-react';
import { WarungProvider, useWarung, type WarungState } from './WarungContext';
import {
  getWarungStateStorageKey,
  getWarungSyncMetadataKey,
  WARUNG_STATE_STORAGE_KEY,
} from '@/domain/menuOrdering';

const syncMocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
}));

vi.mock('@workspace/api-client-react', () => ({
  getWarungState: vi.fn(),
  saveWarungState: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(syncMocks.storage.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      syncMocks.storage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      syncMocks.storage.delete(key);
      return Promise.resolve();
    }),
  },
}));

const mockedGetWarungState = vi.mocked(getWarungState);
const mockedSaveWarungState = vi.mocked(saveWarungState);

function state(label: string): WarungState {
  return {
    menus: [{ id: `${label}-menu`, name: label, price: 10_000, recipe: {} }],
    activeOrders: [],
    kitchenOrders: [],
    inventory: [],
    consignments: [],
    expenses: [],
    sales: [],
    cashClosures: [],
    savingsRules: [],
    savingsEntries: [],
  };
}

function Probe({ onValue }: { onValue: (value: ReturnType<typeof useWarung>) => void }) {
  onValue(useWarung());
  return null;
}

async function renderProvider(userId: string | null) {
  (globalThis as { __kasirMisoUserId?: string | null }).__kasirMisoUserId = userId;
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = userId ? 'test-key' : '';
  let currentValue!: ReturnType<typeof useWarung>;
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <WarungProvider>
        <Probe onValue={(value) => { currentValue = value; }} />
      </WarungProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return { getValue: () => currentValue, renderer };
}

describe('WarungProvider cloud synchronization', () => {
  beforeEach(() => {
    syncMocks.storage.clear();
    mockedGetWarungState.mockReset();
    mockedSaveWarungState.mockReset();
  });

  afterEach(() => {
    (globalThis as { __kasirMisoUserId?: string | null }).__kasirMisoUserId = null;
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = '';
  });

  it('restores the authenticated account snapshot from cloud', async () => {
    const cloud = state('cloud');
    mockedGetWarungState.mockResolvedValue({
      state: cloud as never,
      version: 4,
      updatedAt: '2026-09-20T10:00:00.000Z',
    });

    const { getValue } = await renderProvider('account-cloud');

    expect(getValue().hydrated).toBe(true);
    expect(getValue().menus).toEqual(cloud.menus);
    expect(getValue().syncConflict).toBeNull();
    expect(mockedSaveWarungState).not.toHaveBeenCalled();
  });

  it('uploads anonymous local data only when the account has no cloud snapshot', async () => {
    const local = state('anonymous');
    syncMocks.storage.set(WARUNG_STATE_STORAGE_KEY, JSON.stringify(local));
    mockedGetWarungState.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));
    mockedSaveWarungState.mockResolvedValue({
      state: local as never,
      version: 1,
      updatedAt: '2026-09-20T10:00:00.000Z',
    });

    const { getValue } = await renderProvider('account-new');

    expect(getValue().menus).toEqual(local.menus);
    expect(mockedSaveWarungState).toHaveBeenCalledWith({
      state: expect.objectContaining({
        menus: expect.arrayContaining([expect.objectContaining(local.menus[0])]),
      }),
      baseVersion: null,
    });
    expect(syncMocks.storage.has(WARUNG_STATE_STORAGE_KEY)).toBe(false);
    expect(syncMocks.storage.has(getWarungStateStorageKey('account-new'))).toBe(true);
  });

  it('keeps local data and exposes a merge choice when cloud changed after the last sync', async () => {
    const base = state('base');
    const local = state('local');
    const remote = state('remote');
    syncMocks.storage.set(getWarungStateStorageKey('account-merge'), JSON.stringify(local));
    syncMocks.storage.set(getWarungSyncMetadataKey('account-merge'), JSON.stringify({
      version: 1,
      syncedState: base,
    }));
    mockedGetWarungState.mockResolvedValue({
      state: remote as never,
      version: 2,
      updatedAt: '2026-09-20T10:00:00.000Z',
    });
    mockedSaveWarungState.mockResolvedValue({
      state: {
        ...remote,
        menus: [...remote.menus, ...local.menus],
      } as never,
      version: 3,
      updatedAt: '2026-09-20T10:01:00.000Z',
    });

    const { getValue } = await renderProvider('account-merge');

    expect(getValue().syncConflict).toMatchObject({ remoteVersion: 2 });
    expect(getValue().menus).toEqual(local.menus);

    await act(async () => {
      await getValue().resolveSyncConflict('merge');
    });

    expect(mockedSaveWarungState).toHaveBeenLastCalledWith({
      state: expect.objectContaining({
        menus: [...remote.menus, ...local.menus],
      }),
      baseVersion: 2,
    });
    expect(getValue().syncConflict).toBeNull();
  });

  it('switches account storage on logout and login instead of leaking the previous account', async () => {
    const accountA = state('account-a');
    const accountB = state('account-b');
    syncMocks.storage.set(getWarungStateStorageKey('user-a'), JSON.stringify(accountA));
    syncMocks.storage.set(getWarungStateStorageKey('user-b'), JSON.stringify(accountB));
    mockedGetWarungState
      .mockResolvedValueOnce({ state: accountA as never, version: 1, updatedAt: '2026-09-20T10:00:00.000Z' })
      .mockResolvedValueOnce({ state: accountB as never, version: 1, updatedAt: '2026-09-20T10:00:00.000Z' });

    const mounted = await renderProvider('user-a');
    expect(mounted.getValue().menus).toEqual(accountA.menus);

    await act(async () => {
      (globalThis as { __kasirMisoUserId?: string | null }).__kasirMisoUserId = 'user-b';
      mounted.renderer.update(
        <WarungProvider>
          <Probe onValue={(value) => { (mounted as { getValue: () => ReturnType<typeof useWarung> }).getValue = () => value; }} />
        </WarungProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mounted.getValue().menus).toEqual(accountB.menus);
  });

  it('keeps local data available when the network is unavailable', async () => {
    const local = state('offline');
    syncMocks.storage.set(getWarungStateStorageKey('offline-user'), JSON.stringify(local));
    mockedGetWarungState.mockRejectedValue(new Error('network unavailable'));

    const { getValue } = await renderProvider('offline-user');

    expect(getValue().hydrated).toBe(true);
    expect(getValue().menus).toEqual(local.menus);
    expect(mockedSaveWarungState).not.toHaveBeenCalled();
  });
});