import React, { useMemo, useRef, useState } from 'react';
import { Alert, Animated, Image, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { MenuVariant, useWarung } from '@/context/WarungContext';
import { useColors } from '@/hooks/useColors';
import { EmptyState, IconButton, PageHeader, PrimaryButton, Screen, Surface, ThemeActions } from '@/components/WarungUI';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { persistImageAsset } from '@/utils/persistentImage';
import { createMenuDragHandlers } from '@/domain/menuDrag';

type EditSection = 'menus' | 'ingredients' | 'consignments';

export default function StockEditScreen() {
  const c = useColors();
  const router = useRouter();
  const {
    menus,
    inventory,
    consignments,
    updateMenu,
    updateInventoryItem,
    updateConsignment,
    deleteMenu,
    deleteInventoryItem,
    deleteConsignment,
    reorderMenus,
  } = useWarung();
  const [section, setSection] = useState<EditSection>('menus');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuName, setMenuName] = useState('');
  const [menuPrice, setMenuPrice] = useState('');
  const [menuCategory, setMenuCategory] = useState('Lainnya');
  const [menuImageUri, setMenuImageUri] = useState<string | undefined>();
  const [variantDraft, setVariantDraft] = useState<Array<{ id: string; name: string; priceDelta: string }>>([]);
  const [recipeDraft, setRecipeDraft] = useState<Record<string, string>>({});
  const [stockId, setStockId] = useState<string | null>(null);
  const [stockOpen, setStockOpen] = useState(false);
  const [stockName, setStockName] = useState('');
  const [unit, setUnit] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [safe, setSafe] = useState('');
  const [stockCost, setStockCost] = useState('');
  const [consignmentId, setConsignmentId] = useState<string | null>(null);
  const [consignmentOpen, setConsignmentOpen] = useState(false);
  const [consignmentName, setConsignmentName] = useState('');
  const [consignmentCost, setConsignmentCost] = useState('');
  const [consignmentSellPrice, setConsignmentSellPrice] = useState('');
  const [consignmentPackSize, setConsignmentPackSize] = useState('10');
  const [consignmentQty, setConsignmentQty] = useState('');
  const [consignmentRemainder, setConsignmentRemainder] = useState(0);
  const [consignmentImageUri, setConsignmentImageUri] = useState<string | undefined>();
  const [draggingMenuId, setDraggingMenuId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const menuLayouts = useRef<Record<string, { y: number; height: number }>>({});
  const activeDrag = useRef<{ id: string; index: number } | null>(null);

  const closeMenu = () => {
    setMenuId(null);
    setMenuName('');
    setMenuPrice('');
    setMenuCategory('Lainnya');
    setMenuImageUri(undefined);
    setVariantDraft([]);
    setRecipeDraft({});
    setMenuOpen(false);
  };
  const closeStock = () => {
    setStockId(null);
    setStockName('');
    setUnit('');
    setStockQty('');
    setSafe('');
    setStockCost('');
    setStockOpen(false);
  };
  const closeConsignment = () => {
    setConsignmentId(null);
    setConsignmentName('');
    setConsignmentCost('');
    setConsignmentSellPrice('');
    setConsignmentPackSize('10');
    setConsignmentQty('');
    setConsignmentRemainder(0);
    setConsignmentImageUri(undefined);
    setConsignmentOpen(false);
  };

  const openMenu = (menu: typeof menus[number]) => {
    setMenuId(menu.id);
    setMenuName(menu.name);
    setMenuPrice(String(menu.price));
    setMenuCategory(menu.category || 'Lainnya');
    setMenuImageUri(menu.imageUri);
    setVariantDraft((menu.variants ?? []).map((variant) => ({ id: variant.id, name: variant.name, priceDelta: String(variant.priceDelta) })));
    setRecipeDraft(Object.fromEntries(Object.entries(menu.recipe).map(([id, quantity]) => [id, String(quantity)])));
    setMenuOpen(true);
  };
  const openStock = (item: typeof inventory[number]) => {
    setStockId(item.id);
    setStockName(item.name);
    setUnit(item.unit);
    setStockQty(String(item.qty));
    setSafe(String(item.safe));
    setStockCost(String(item.cost ?? 0));
    setStockOpen(true);
  };
  const openConsignment = (item: typeof consignments[number]) => {
    const packSize = item.packSize || 1;
    setConsignmentId(item.id);
    setConsignmentName(item.name);
    setConsignmentCost(String(item.cost));
    setConsignmentSellPrice(String(item.sellPrice));
    setConsignmentPackSize(String(packSize));
    setConsignmentQty(String(Math.floor(item.qty / packSize)));
    setConsignmentRemainder(item.qty % packSize);
    setConsignmentImageUri(item.imageUri);
    setConsignmentOpen(true);
  };

  const saveMenu = () => {
    const price = Number(menuPrice);
    if (!menuId || !menuName.trim() || !Number.isFinite(price) || price <= 0) {
      Alert.alert('Menu belum lengkap', 'Isi nama dan harga menu dengan benar.');
      return;
    }
    const recipe = Object.fromEntries(
      Object.entries(recipeDraft)
        .filter(([, quantity]) => Number(quantity) > 0)
        .map(([id, quantity]) => [id, Number(quantity)]),
    );
    const variants: MenuVariant[] = variantDraft
      .filter((variant) => variant.name.trim())
      .map((variant) => ({ id: variant.id, name: variant.name.trim(), priceDelta: Number(variant.priceDelta) || 0 }));
    if (new Set(variants.map((variant) => variant.name.toLocaleLowerCase())).size !== variants.length) {
      Alert.alert('Varian duplikat', 'Gunakan nama varian yang berbeda.');
      return;
    }
    updateMenu(menuId, menuName.trim(), price, recipe, menuCategory.trim() || 'Lainnya', menuImageUri, variants);
    closeMenu();
  };
  const saveStock = () => {
    const quantity = Number(stockQty);
    const safeQuantity = Number(safe);
    const cost = Number(stockCost);
    if (!stockId || !stockName.trim() || !unit.trim() || !Number.isFinite(quantity) || !Number.isFinite(safeQuantity) || !Number.isFinite(cost) || quantity < 0 || safeQuantity < 0 || cost < 0) {
      Alert.alert('Bahan belum lengkap', 'Isi nama, satuan, jumlah, batas aman, dan harga beli dengan benar.');
      return;
    }
    if (inventory.some((item) => item.id !== stockId && item.name.trim().toLocaleLowerCase() === stockName.trim().toLocaleLowerCase())) {
      Alert.alert('Bahan sudah ada', 'Gunakan nama bahan yang berbeda.');
      return;
    }
    updateInventoryItem(stockId, stockName.trim(), unit.trim(), quantity, safeQuantity, cost);
    closeStock();
  };
  const saveConsignment = () => {
    const cost = Number(consignmentCost);
    const sellPrice = Number(consignmentSellPrice);
    const packSize = Number(consignmentPackSize);
    const packCount = Number(consignmentQty);
    if (!consignmentId || !consignmentName.trim() || !Number.isFinite(cost) || !Number.isFinite(sellPrice) || !Number.isFinite(packSize) || !Number.isFinite(packCount) || cost < 0 || sellPrice < 0 || packSize <= 0 || !Number.isInteger(packSize) || packCount < 0 || !Number.isInteger(packCount)) {
      Alert.alert('Titipan belum lengkap', 'Isi nama, harga, isi plastik, dan jumlah plastik dengan benar.');
      return;
    }
    const quantity = packCount * packSize + consignmentRemainder;
    updateConsignment(consignmentId, consignmentName.trim(), cost, sellPrice, quantity, packSize, consignmentImageUri);
    closeConsignment();
  };

  const updateRecipeQuantity = (id: string, delta: number) => {
    setRecipeDraft((current) => {
      const next = Math.max(0, (Number(current[id]) || 0) + delta);
      if (next === 0) {
        const { [id]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [id]: String(next) };
    });
  };
  const pickImage = async (kind: 'menu' | 'consignment') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85, base64: true });
      if (result.canceled || !result.assets[0]?.uri) return;
      const uri = await persistImageAsset(result.assets[0]);
      if (kind === 'menu') setMenuImageUri(uri);
      else setConsignmentImageUri(uri);
    } catch {
      Alert.alert('Gambar tidak tersedia', 'Gambar tidak bisa dibuka. Coba pilih gambar lain.');
    }
  };
  const deleteItem = (kind: EditSection, id: string, name: string) => {
    Alert.alert(`Hapus ${kind === 'menus' ? 'menu' : kind === 'ingredients' ? 'bahan' : 'titipan'}?`, `${name} akan dihapus dari data warung.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => kind === 'menus' ? deleteMenu(id) : kind === 'ingredients' ? deleteInventoryItem(id) : deleteConsignment(id),
      },
    ]);
  };

  const menuPanResponders = useMemo(() => new Map(
    menus.map((menu, index) => {
      const responder = PanResponder.create(createMenuDragHandlers({
        menus,
        menuId: menu.id,
        menuIndex: index,
        menuLayouts: menuLayouts.current,
        activeDrag,
        onDragStart: () => {
          setDraggingMenuId(menu.id);
          setDragOffset(0);
          void Haptics.selectionAsync().catch(() => undefined);
        },
        onDragMove: (dy) => setDragOffset(dy),
        onDragEnd: () => {
          setDraggingMenuId(null);
          setDragOffset(0);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        },
        onDragCancel: () => {
          setDraggingMenuId(null);
          setDragOffset(0);
        },
        reorderMenus,
      }));
      return [menu.id, responder] as const;
    }),
  ), [menus, reorderMenus]);

  return (
    <Screen contentBottomInset={false}>
      <PageHeader
        eyebrow="Manajemen warung"
        title="Edit data stok"
        subtitle="Atur urutan data menu, bahan baku, dan barang titipan."
        action={
          <View style={s.headerActions}>
            <Pressable accessibilityLabel="Kembali ke Lainnya" hitSlop={10} onPress={() => router.back()} style={({ pressed }) => [s.backButton, { backgroundColor: c.primaryForeground, opacity: pressed ? 0.72 : 1 }]}>
              <Ionicons name="arrow-back" size={20} color={c.primary} />
            </Pressable>
            <ThemeActions />
          </View>
        }
      />
      <View style={[s.orderNote, { backgroundColor: c.secondary }]}>
        <Ionicons name="swap-vertical-outline" size={18} color={c.primary} />
      </View>
      <View style={s.tabs}>
        {([
          ['menus', 'Menu', 'restaurant-outline'],
          ['ingredients', 'Bahan baku', 'cube-outline'],
          ['consignments', 'Barang titipan', 'storefront-outline'],
        ] as const).map(([value, label, icon]) => (
          <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Edit ${label}`} onPress={() => setSection(value)} style={[s.tab, { backgroundColor: section === value ? c.primary : c.secondary }]}>
            <Ionicons name={icon} size={17} color={section === value ? c.primaryForeground : c.primary} />
            <Text style={[s.tabText, { color: section === value ? c.primaryForeground : c.foreground }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
       <ScrollView scrollEnabled={!draggingMenuId} showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
        {section === 'menus' ? (
          menus.length ? menus.map((menu) => (
            <Animated.View
              key={menu.id}
              {...menuPanResponders.get(menu.id)?.panHandlers}
              testID={`menu-order-${menu.id}`}
              onLayout={(event) => {
                const { y, height } = event.nativeEvent.layout;
                menuLayouts.current[menu.id] = { y, height };
              }}
              style={[
                draggingMenuId === menu.id ? s.draggingItem : undefined,
                draggingMenuId === menu.id ? { transform: [{ translateY: dragOffset }] } : undefined,
              ]}
            >
              <Surface style={[s.item, draggingMenuId === menu.id ? { borderColor: c.primary, backgroundColor: c.secondary } : undefined]}>
                <View style={[s.dragHandle, { backgroundColor: c.secondary }]}>
                  <Ionicons name="reorder-three-outline" size={21} color={c.primary} />
                </View>
                <View style={[s.itemIcon, { backgroundColor: c.secondary }]}>{menu.imageUri ? <Image source={{ uri: menu.imageUri }} style={s.imageFill} /> : <Ionicons name="restaurant-outline" size={20} color={c.primary} />}</View>
                <View style={s.flex}><Text style={[s.name, { color: c.foreground }]}>{menu.name}</Text><Text style={[s.detail, { color: c.mutedForeground }]}>{menu.category || 'Lainnya'} · Rp {menu.price.toLocaleString('id-ID')}</Text></View>
                <IconButton icon="create-outline" label={`Edit ${menu.name}`} onPress={() => openMenu(menu)} />
                <IconButton icon="trash-outline" label={`Hapus ${menu.name}`} onPress={() => deleteItem('menus', menu.id, menu.name)} />
              </Surface>
            </Animated.View>
          )) : <EmptyState icon="restaurant-outline" title="Belum ada menu" body="Buat menu terlebih dahulu dari halaman Stok." />
        ) : null}
        {section === 'ingredients' ? (
          inventory.length ? inventory.map((item) => (
            <Surface key={item.id} style={s.item}>
              <View style={[s.itemIcon, { backgroundColor: item.qty <= item.safe ? c.muted : c.secondary }]}><Ionicons name="cube-outline" size={20} color={item.qty <= item.safe ? c.destructive : c.primary} /></View>
              <View style={s.flex}><Text style={[s.name, { color: c.foreground }]}>{item.name}</Text><Text style={[s.detail, { color: c.mutedForeground }]}>{item.qty} {item.unit} · batas aman {item.safe} {item.unit}</Text></View>
              <IconButton icon="create-outline" label={`Edit ${item.name}`} onPress={() => openStock(item)} />
              <IconButton icon="trash-outline" label={`Hapus ${item.name}`} onPress={() => deleteItem('ingredients', item.id, item.name)} />
            </Surface>
          )) : <EmptyState icon="cube-outline" title="Belum ada bahan baku" body="Tambahkan bahan terlebih dahulu dari halaman Stok." />
        ) : null}
        {section === 'consignments' ? (
          consignments.length ? consignments.map((item) => (
            <Surface key={item.id} style={s.item}>
              <View style={[s.itemIcon, { backgroundColor: c.secondary }]}>{item.imageUri ? <Image source={{ uri: item.imageUri }} style={s.imageFill} /> : <Ionicons name="storefront-outline" size={20} color={c.primary} />}</View>
              <View style={s.flex}><Text style={[s.name, { color: c.foreground }]}>{item.name}</Text><Text style={[s.detail, { color: c.mutedForeground }]}>{item.qty} biji · {item.packSize || 1} biji / plastik</Text></View>
              <IconButton icon="create-outline" label={`Edit ${item.name}`} onPress={() => openConsignment(item)} />
               <IconButton icon="trash-outline" label={`Hapus ${item.name}`} onPress={() => deleteItem('consignments', item.id, item.name)} />
            </Surface>
          )) : <EmptyState icon="storefront-outline" title="Belum ada barang titipan" body="Tambahkan barang titipan terlebih dahulu dari halaman Stok." />
        ) : null}
      </ScrollView>

      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={closeMenu}>
        <View style={[s.backdrop, { backgroundColor: c.foreground + 'B8' }]}>
          <KeyboardAwareScrollViewCompat style={s.modalScroll} contentContainerStyle={s.modalScrollContent} keyboardShouldPersistTaps="handled" bottomOffset={20}>
            <View style={[s.modal, { backgroundColor: c.card }]}>
              <ModalHeader title="Edit menu" onClose={closeMenu} c={c} />
              <Text style={[s.label, { color: c.mutedForeground }]}>Nama menu</Text>
              <TextInput value={menuName} onChangeText={setMenuName} autoCapitalize="words" style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
              <Text style={[s.label, { color: c.mutedForeground }]}>Kategori</Text>
              <View style={s.categoryOptions}>{['Bakso', 'Mie ayam', 'Minuman', 'Lainnya'].map((category) => <Pressable key={category} onPress={() => setMenuCategory(category)} style={[s.categoryOption, { backgroundColor: menuCategory === category ? c.primary : c.secondary }]}><Text style={{ color: menuCategory === category ? c.primaryForeground : c.secondaryForeground }}>{category}</Text></Pressable>)}</View>
              <TextInput value={menuCategory} onChangeText={setMenuCategory} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
              <Text style={[s.label, { color: c.mutedForeground }]}>Gambar menu</Text>
              <ImagePickerRow uri={menuImageUri} label="Ganti gambar menu" onPress={() => void pickImage('menu')} c={c} />
              <Text style={[s.label, { color: c.mutedForeground }]}>Harga jual</Text>
              <TextInput value={menuPrice} onChangeText={setMenuPrice} keyboardType="number-pad" style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
              <Text style={[s.label, { color: c.mutedForeground }]}>Bahan per porsi</Text>
              {inventory.map((item) => {
                const quantity = Number(recipeDraft[item.id]) || 0;
                return <View key={item.id} style={[s.recipeRow, { borderColor: c.border }]}><Text style={[s.flex, s.detail, { color: c.foreground }]}>{item.name} · {quantity} {item.unit}</Text><Pressable onPress={() => updateRecipeQuantity(item.id, -1)} style={[s.recipeButton, { backgroundColor: c.secondary }]}><Ionicons name="remove" size={16} color={c.secondaryForeground} /></Pressable><Pressable onPress={() => updateRecipeQuantity(item.id, 1)} style={[s.recipeButton, { backgroundColor: c.primary }]}><Ionicons name="add" size={16} color={c.primaryForeground} /></Pressable></View>;
              })}
              <PrimaryButton onPress={saveMenu} icon="checkmark-circle-outline">Simpan perubahan</PrimaryButton>
            </View>
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>

      <Modal visible={stockOpen} transparent animationType="slide" onRequestClose={closeStock}>
        <View style={[s.backdrop, { backgroundColor: c.foreground + 'B8' }]}>
          <KeyboardAwareScrollViewCompat contentContainerStyle={s.modalScrollContent} keyboardShouldPersistTaps="handled" bottomOffset={20}>
            <View style={[s.modal, { backgroundColor: c.card }]}>
              <ModalHeader title="Edit bahan baku" onClose={closeStock} c={c} />
              <Text style={[s.label, { color: c.mutedForeground }]}>Nama bahan</Text><TextInput value={stockName} onChangeText={setStockName} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
              <View style={s.row}><View style={s.flex}><Text style={[s.label, { color: c.mutedForeground }]}>Satuan</Text><TextInput value={unit} onChangeText={setUnit} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} /></View><View style={s.flex}><Text style={[s.label, { color: c.mutedForeground }]}>Jumlah</Text><TextInput value={stockQty} onChangeText={setStockQty} keyboardType="number-pad" style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} /></View></View>
              <Text style={[s.label, { color: c.mutedForeground }]}>Harga beli per satuan</Text><TextInput value={stockCost} onChangeText={setStockCost} keyboardType="number-pad" placeholder="Contoh: 2500" style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
              <Text style={[s.label, { color: c.mutedForeground }]}>Batas aman</Text><TextInput value={safe} onChangeText={setSafe} keyboardType="number-pad" style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
              <PrimaryButton onPress={saveStock} icon="checkmark-outline">Simpan perubahan</PrimaryButton>
            </View>
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>

      <Modal visible={consignmentOpen} transparent animationType="slide" onRequestClose={closeConsignment}>
        <View style={[s.backdrop, { backgroundColor: c.foreground + 'B8' }]}>
          <KeyboardAwareScrollViewCompat style={s.modalScroll} contentContainerStyle={s.modalScrollContent} keyboardShouldPersistTaps="handled" bottomOffset={20}>
            <View style={[s.modal, { backgroundColor: c.card }]}>
              <ModalHeader title="Edit barang titipan" onClose={closeConsignment} c={c} />
              <Text style={[s.label, { color: c.mutedForeground }]}>Nama barang</Text><TextInput value={consignmentName} onChangeText={setConsignmentName} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
              <Text style={[s.label, { color: c.mutedForeground }]}>Gambar titipan</Text><ImagePickerRow uri={consignmentImageUri} label="Ganti gambar titipan" onPress={() => void pickImage('consignment')} c={c} />
              <View style={s.row}><View style={s.flex}><Text style={[s.label, { color: c.mutedForeground }]}>Harga penitip / plastik</Text><TextInput value={consignmentCost} onChangeText={setConsignmentCost} keyboardType="number-pad" style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} /></View><View style={s.flex}><Text style={[s.label, { color: c.mutedForeground }]}>Isi / plastik</Text><TextInput value={consignmentPackSize} onChangeText={setConsignmentPackSize} keyboardType="number-pad" style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} /></View></View>
              <Text style={[s.label, { color: c.mutedForeground }]}>Harga jual / biji</Text><TextInput value={consignmentSellPrice} onChangeText={setConsignmentSellPrice} keyboardType="number-pad" style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
              <Text style={[s.label, { color: c.mutedForeground }]}>Jumlah plastik</Text><TextInput value={consignmentQty} onChangeText={setConsignmentQty} keyboardType="number-pad" style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
              <PrimaryButton onPress={saveConsignment} icon="checkmark-circle-outline">Simpan perubahan</PrimaryButton>
            </View>
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>
    </Screen>
  );
}

function ModalHeader({ title, onClose, c }: { title: string; onClose: () => void; c: ReturnType<typeof useColors> }) {
  return <View style={s.modalHead}><View><Text style={[s.modalKicker, { color: c.primary }]}>EDIT DATA STOK</Text><Text style={[s.modalTitle, { color: c.foreground }]}>{title}</Text></View><Pressable accessibilityLabel={`Tutup ${title}`} onPress={onClose}><Ionicons name="close-circle" size={27} color={c.mutedForeground} /></Pressable></View>;
}

function ImagePickerRow({ uri, label, onPress, c }: { uri?: string; label: string; onPress: () => void; c: ReturnType<typeof useColors> }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[s.imagePicker, { borderColor: c.primary, backgroundColor: c.secondary }]}>{uri ? <Image source={{ uri }} style={s.pickerImage} /> : <Ionicons name="image-outline" size={25} color={c.primary} />}<Text style={[s.imagePickerTitle, { color: c.foreground }]}>{label}</Text></Pressable>;
}

const s = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  orderNote: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 13, borderRadius: 15, marginBottom: 12 },
  orderText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 7, marginBottom: 14 },
  tab: { flex: 1, minHeight: 62, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, gap: 4 },
  tabText: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
  list: { paddingBottom: 30 },
  item: { minHeight: 68, padding: 11, flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  draggingItem: { zIndex: 10, elevation: 6, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  dragHandle: { width: 27, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 7 },
  itemIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 10, overflow: 'hidden' },
  imageFill: { width: '100%', height: '100%' },
  flex: { flex: 1 },
  name: { fontSize: 14, fontWeight: '800' },
  detail: { fontSize: 11, lineHeight: 17, marginTop: 3 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  modalScroll: { flexGrow: 0, maxHeight: '90%' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 35 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  modalKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  modalTitle: { fontSize: 23, fontWeight: '800', marginTop: 3 },
  label: { fontSize: 11, fontWeight: '800', marginBottom: 7, marginTop: 8 },
  input: { height: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontSize: 14, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 9 },
  categoryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  categoryOption: { borderRadius: 12, paddingVertical: 9, paddingHorizontal: 11 },
  imagePicker: { minHeight: 58, borderWidth: 1, borderRadius: 15, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  pickerImage: { width: 42, height: 42, borderRadius: 12 },
  imagePickerTitle: { fontSize: 13, fontWeight: '800' },
  recipeRow: { minHeight: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  recipeButton: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});