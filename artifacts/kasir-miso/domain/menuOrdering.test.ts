import { describe, expect, it, vi } from 'vitest';
import type { ConsignmentItem, MenuItem, WarungState } from '@/context/WarungContext';
import { buildCatalogItems } from './menuCatalog';
import { createMenuDragHandlers, type ActiveMenuDrag } from './menuDrag';
import {
  hydrateWarungState,
  isRestorableWarungState,
  persistWarungState,
  persistWarungStateSafely,
  reorderMenuItems,
  WARUNG_STATE_STORAGE_KEY,
} from './menuOrdering';

const menus: MenuItem[] = [
  { id: 'mie', name: 'Mie Ayam', price: 12_000, recipe: {} },
  { id: 'bakso', name: 'Bakso', price: 14_000, recipe: {} },
  { id: 'es-teh', name: 'Es Teh', price: 5_000, recipe: {} },
];

const consignments: ConsignmentItem[] = [];

function stateWithMenus(menuItems: MenuItem[]): WarungState {
  return {
    menus: menuItems,
    activeOrders: [],
    kitchenOrders: [],
    inventory: [],
    consignments,
    expenses: [],
    sales: [],
    cashClosures: [],
    savingsRules: [],
    savingsEntries: [],
  };
}

describe('menu order persistence', () => {
  it('keeps a successful Edit Stok drag after reopening and uses it in Dapur', async () => {
    const storage = new Map<string, string>();
    let currentState = stateWithMenus(menus);
    const activeDrag: ActiveMenuDrag = { current: null };
    const reorderMenus = vi.fn((id: string, toIndex: number) => {
      const nextMenus = reorderMenuItems(currentState.menus, id, toIndex);
      if (nextMenus === currentState.menus) return;

      currentState = { ...currentState, menus: nextMenus };
      void persistWarungState(currentState, async (key, value) => {
        storage.set(key, value);
      });
    });
    const handlers = createMenuDragHandlers({
      menus,
      menuId: 'mie',
      menuIndex: 0,
      menuLayouts: {
        mie: { y: 0, height: 68 },
        bakso: { y: 77, height: 68 },
        'es-teh': { y: 154, height: 68 },
      },
      activeDrag,
      onDragStart: vi.fn(),
      onDragMove: vi.fn(),
      onDragEnd: vi.fn(),
      onDragCancel: vi.fn(),
      reorderMenus,
    });

    handlers.onPanResponderGrant();
    handlers.onPanResponderMove({}, { dy: 170, dx: 0 });
    handlers.onPanResponderRelease({}, { dy: 170, dx: 0 });

    expect(reorderMenus).toHaveBeenCalledWith('mie', 2);
    expect(currentState.menus.map((menu) => menu.id)).toEqual(['bakso', 'es-teh', 'mie']);
    expect(JSON.parse(storage.get(WARUNG_STATE_STORAGE_KEY) ?? '{}').menus.map((menu: MenuItem) => menu.id))
      .toEqual(['bakso', 'es-teh', 'mie']);

    const restoredState = await hydrateWarungState(
      storage.get(WARUNG_STATE_STORAGE_KEY) ?? null,
      async (uri) => uri,
    );
    const dapurCatalog = buildCatalogItems(restoredState.menus, restoredState.consignments);

    expect(restoredState.menus.map((menu) => menu.id)).toEqual(['bakso', 'es-teh', 'mie']);
    expect(dapurCatalog.map((menu) => menu.id)).toEqual(['bakso', 'es-teh', 'mie']);
    expect(dapurCatalog.map((menu) => menu.name)).toEqual(['Bakso', 'Es Teh', 'Mie Ayam']);
  });

  it('accepts a legacy restore payload with optional fields omitted', () => {
    expect(isRestorableWarungState({
      menus: [],
      expenses: [{ id: 'legacy-expense', title: 'Belanja lama', amount: 10_000, date: '2026-09-10' }],
      sales: [],
    })).toBe(true);
    expect(isRestorableWarungState({})).toBe(false);
    expect(isRestorableWarungState({ menus: 'corrupt' })).toBe(false);
    expect(isRestorableWarungState({ menus: [], qrisImageUri: 123 })).toBe(false);
  });

  it('restores the previous state when writing the new state fails', async () => {
    const previousState = stateWithMenus(menus);
    const nextState = { ...previousState, menus: [menus[2]] };
    const storage = new Map<string, string>();
    let attempts = 0;
    const setItem = async (key: string, value: string) => {
      attempts += 1;
      storage.set(key, value);
      if (attempts === 1) throw new Error('storage unavailable');
    };

    await expect(persistWarungStateSafely(previousState, nextState, setItem))
      .rejects.toThrow('storage unavailable');
    expect(JSON.parse(storage.get(WARUNG_STATE_STORAGE_KEY) ?? '{}').menus)
      .toEqual(previousState.menus);
  });
});

describe('edit stock menu drag gesture', () => {
  const layouts = {
    mie: { y: 0, height: 68 },
    bakso: { y: 77, height: 68 },
    'es-teh': { y: 154, height: 68 },
  };

  function createGestureFor(menuId: string, menuIndex: number) {
    const activeDrag: ActiveMenuDrag = { current: null };
    const reorderMenus = vi.fn();
    const onDragStart = vi.fn();
    const onDragMove = vi.fn();
    const onDragEnd = vi.fn();
    const onDragCancel = vi.fn();
    const handlers = createMenuDragHandlers({
      menus,
      menuId,
      menuIndex,
      menuLayouts: layouts,
      activeDrag,
      onDragStart,
      onDragMove,
      onDragEnd,
      onDragCancel,
      reorderMenus,
    });

    return { activeDrag, handlers, onDragCancel, onDragEnd, onDragMove, reorderMenus };
  }

  it('moves a menu to the intended target index when the gesture is released', () => {
    const { activeDrag, handlers, onDragEnd, onDragMove, reorderMenus } = createGestureFor('mie', 0);

    expect(handlers.onMoveShouldSetPanResponder({}, { dy: 4, dx: 0 })).toBe(false);
    expect(handlers.onMoveShouldSetPanResponder({}, { dy: 20, dx: 30 })).toBe(false);
    expect(handlers.onMoveShouldSetPanResponder({}, { dy: 20, dx: 2 })).toBe(true);

    handlers.onPanResponderGrant();
    handlers.onPanResponderMove({}, { dy: 170, dx: 0 });
    handlers.onPanResponderRelease({}, { dy: 170, dx: 0 });

    expect(onDragMove).toHaveBeenCalledWith(170);
    expect(reorderMenus).toHaveBeenCalledWith('mie', 2);
    expect(onDragEnd).toHaveBeenCalledOnce();
    expect(activeDrag.current).toBeNull();
  });

  it('clamps a release above the first item to the first index', () => {
    const { activeDrag, handlers, reorderMenus } = createGestureFor('mie', 0);

    handlers.onPanResponderGrant();
    handlers.onPanResponderRelease({}, { dy: -500, dx: 0 });

    expect(reorderMenus).toHaveBeenCalledWith('mie', 0);
    expect(activeDrag.current).toBeNull();
  });

  it('clamps a release below the last item to the last index', () => {
    const { activeDrag, handlers, reorderMenus } = createGestureFor('es-teh', 2);

    handlers.onPanResponderGrant();
    handlers.onPanResponderRelease({}, { dy: 500, dx: 0 });

    expect(reorderMenus).toHaveBeenCalledWith('es-teh', 2);
    expect(activeDrag.current).toBeNull();
  });

  it('uses each card center when card heights are different', () => {
    const unevenLayouts = {
      mie: { y: 0, height: 116 },
      bakso: { y: 125, height: 52 },
      'es-teh': { y: 186, height: 124 },
    };
    const activeDrag: ActiveMenuDrag = { current: null };
    const reorderMenus = vi.fn();
    const handlers = createMenuDragHandlers({
      menus,
      menuId: 'mie',
      menuIndex: 0,
      menuLayouts: unevenLayouts,
      activeDrag,
      onDragStart: vi.fn(),
      onDragMove: vi.fn(),
      onDragEnd: vi.fn(),
      onDragCancel: vi.fn(),
      reorderMenus,
    });

    // The release point is y=181, in the gap after Bakso and before Es Teh.
    handlers.onPanResponderGrant();
    handlers.onPanResponderRelease({}, { dy: 123, dx: 0 });

    expect(reorderMenus).toHaveBeenCalledWith('mie', 1);
  });

  it('keeps uneven-layout releases clamped to the first and last index', () => {
    const unevenLayouts = {
      mie: { y: 0, height: 116 },
      bakso: { y: 125, height: 52 },
      'es-teh': { y: 186, height: 124 },
    };

    const createUnevenGesture = (menuId: string, menuIndex: number) => {
      const activeDrag: ActiveMenuDrag = { current: null };
      const reorderMenus = vi.fn();
      const handlers = createMenuDragHandlers({
        menus,
        menuId,
        menuIndex,
        menuLayouts: unevenLayouts,
        activeDrag,
        onDragStart: vi.fn(),
        onDragMove: vi.fn(),
        onDragEnd: vi.fn(),
        onDragCancel: vi.fn(),
        reorderMenus,
      });
      return { handlers, reorderMenus };
    };

    const first = createUnevenGesture('mie', 0);
    first.handlers.onPanResponderGrant();
    first.handlers.onPanResponderRelease({}, { dy: -500, dx: 0 });

    const last = createUnevenGesture('es-teh', 2);
    last.handlers.onPanResponderGrant();
    last.handlers.onPanResponderRelease({}, { dy: 500, dx: 0 });

    expect(first.reorderMenus).toHaveBeenCalledWith('mie', 0);
    expect(last.reorderMenus).toHaveBeenCalledWith('es-teh', 2);
  });

  it('clears an interrupted drag without reordering the menu', () => {
    const { activeDrag, handlers, onDragCancel, onDragEnd, reorderMenus } = createGestureFor('mie', 0);

    handlers.onPanResponderGrant();
    handlers.onPanResponderMove({}, { dy: 170, dx: 0 });
    handlers.onPanResponderTerminate();
    handlers.onPanResponderRelease({}, { dy: 170, dx: 0 });

    expect(activeDrag.current).toBeNull();
    expect(onDragCancel).toHaveBeenCalledOnce();
    expect(onDragEnd).not.toHaveBeenCalled();
    expect(reorderMenus).not.toHaveBeenCalled();
  });
});