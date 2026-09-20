import { describe, expect, it } from 'vitest';
import type { WarungState } from '@/context/WarungContext';
import { mergeWarungStates, parseSyncMetadata, stateSnapshotKey } from './syncConflict';

function state(overrides: Partial<WarungState> = {}): WarungState {
  return {
    menus: [],
    activeOrders: [],
    kitchenOrders: [],
    inventory: [],
    consignments: [],
    expenses: [],
    sales: [],
    cashClosures: [],
    savingsRules: [],
    savingsEntries: [],
    ...overrides,
  };
}

describe('warung sync conflict resolution', () => {
  it('keeps remote records and adds local records when merging snapshots', () => {
    const local = state({
      menus: [
        { id: 'shared', name: 'Mie lokal', price: 12_000, recipe: {} },
        { id: 'local-only', name: 'Es lokal', price: 5_000, recipe: {} },
      ],
    });
    const remote = state({
      menus: [
        { id: 'shared', name: 'Mie cloud', price: 13_000, recipe: {} },
        { id: 'remote-only', name: 'Bakso cloud', price: 14_000, recipe: {} },
      ],
    });

    expect(mergeWarungStates(local, remote).menus).toEqual([
      { id: 'shared', name: 'Mie lokal', price: 12_000, recipe: {} },
      { id: 'remote-only', name: 'Bakso cloud', price: 14_000, recipe: {} },
      { id: 'local-only', name: 'Es lokal', price: 5_000, recipe: {} },
    ]);
  });

  it('rejects malformed sync metadata without affecting the local state', () => {
    expect(parseSyncMetadata(null)).toBeNull();
    expect(parseSyncMetadata('not-json')).toBeNull();
    expect(parseSyncMetadata(JSON.stringify({ version: 1, syncedState: state() })))
      .toMatchObject({ version: 1 });
    expect(stateSnapshotKey(state())).toBe(stateSnapshotKey(state()));
  });
});