import React, { useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useWarung } from '@/context/WarungContext';
import { useColors } from '@/hooks/useColors';
import { EmptyState, IconButton, PageHeader, PrimaryButton, Screen, SectionHeader, Surface, ThemeActions } from '@/components/WarungUI';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { persistImageAsset } from '@/utils/persistentImage';

type StockSection = 'overview' | 'menus' | 'ingredients' | 'consignments';

export default function InventoryScreen() {
  const c = useColors();
  const { menus, inventory, stockMovements = [], consignments, addMenu, deleteMenu, addInventoryItem, deleteInventoryItem, addStock, removeStock, addConsignment, deleteConsignment, addConsignmentStock, removeConsignmentStock } = useWarung();
  const [section, setSection] = useState<StockSection>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [menuName, setMenuName] = useState('');
  const [menuPrice, setMenuPrice] = useState('');
  const [menuCategory, setMenuCategory] = useState('Bakso');
  const [menuImageUri, setMenuImageUri] = useState<string | undefined>();
  const [recipeDraft, setRecipeDraft] = useState<Record<string, string>>({});
  const [stockName, setStockName] = useState('');
  const [unit, setUnit] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [safe, setSafe] = useState('');
  const [stockCost, setStockCost] = useState('');
  const [restockOpen, setRestockOpen] = useState(false);
  const [restockItemId, setRestockItemId] = useState('');
  const [restockQty, setRestockQty] = useState('');
  const [restockReason, setRestockReason] = useState('');
  const [consignmentOpen, setConsignmentOpen] = useState(false);
  const [consignmentName, setConsignmentName] = useState('');
  const [consignmentCost, setConsignmentCost] = useState('');
  const [consignmentSellPrice, setConsignmentSellPrice] = useState('');
  const [consignmentPackSize, setConsignmentPackSize] = useState('10');
  const [consignmentQty, setConsignmentQty] = useState('');
  const [consignmentImageUri, setConsignmentImageUri] = useState<string | undefined>();
  const editingMenuId = null;
  const editingStockId = null;
  const editingConsignmentId = null;
  const lowCount = inventory.filter((item) => item.qty <= item.safe).length;
  const resetMenu = () => { setMenuName(''); setMenuPrice(''); setMenuCategory('Bakso'); setMenuImageUri(undefined); setRecipeDraft({}); setMenuOpen(false); };
  const resetStock = () => { setStockName(''); setUnit(''); setStockQty(''); setSafe(''); setStockCost(''); setStockOpen(false); };
  const resetRestock = () => { setRestockItemId(inventory[0]?.id ?? ''); setRestockQty(''); setRestockReason(''); setRestockOpen(false); };
  const resetConsignment = () => { setConsignmentName(''); setConsignmentCost(''); setConsignmentSellPrice(''); setConsignmentPackSize('10'); setConsignmentQty(''); setConsignmentImageUri(undefined); setConsignmentOpen(false); };
  const saveMenu = () => {
    const price = Number(menuPrice);
    if (!menuName.trim() || !Number.isFinite(price) || price <= 0) return Alert.alert('Menu belum lengkap', 'Isi nama dan harga menu dengan benar.');
    const recipe = Object.fromEntries(Object.entries(recipeDraft).filter(([, quantity]) => Number(quantity) > 0).map(([id, quantity]) => [id, Number(quantity)]));
    addMenu(menuName.trim(), price, recipe, menuCategory.trim() || 'Lainnya', menuImageUri);
    resetMenu();
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
  const uploadMenuImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85, base64: true });
      if (!result.canceled && result.assets[0]?.uri) {
        setMenuImageUri(await persistImageAsset(result.assets[0]));
      }
    } catch {
      Alert.alert('Gambar tidak tersedia', 'Gambar tidak bisa dibuka. Coba pilih gambar lain.');
    }
  };
  const saveStock = () => {
    const quantity = Number(stockQty);
    const safeQuantity = Number(safe);
    const cost = Number(stockCost);
    if (!stockName.trim() || !unit.trim() || !Number.isFinite(quantity) || !Number.isFinite(safeQuantity) || !Number.isFinite(cost) || quantity < 0 || safeQuantity < 0 || cost < 0) {
      return Alert.alert('Stok belum lengkap', 'Isi nama, satuan, jumlah, batas aman, dan harga beli dengan benar.');
    }
    if (inventory.some((item) => item.name.trim().toLocaleLowerCase() === stockName.trim().toLocaleLowerCase())) {
      return Alert.alert('Bahan sudah ada', 'Gunakan tombol tambah pada bahan yang sudah terdaftar untuk menambah jumlahnya.');
    }
    addInventoryItem(stockName.trim(), unit.trim(), quantity, safeQuantity, cost);
    resetStock();
  };
  const saveRestock = () => {
    const quantity = Number(restockQty);
    if (!restockItemId || !Number.isFinite(quantity) || quantity <= 0) {
      return Alert.alert('Stok masuk belum lengkap', 'Pilih bahan dan isi jumlah stok masuk lebih dari nol.');
    }
    addStock(restockItemId, quantity, restockReason.trim() || 'Stok masuk');
    resetRestock();
  };
  const confirmDelete = (id: string, name: string) => Alert.alert('Hapus menu?', `${name} tidak akan muncul di kasir lagi.`, [{ text: 'Batal', style: 'cancel' }, { text: 'Hapus', style: 'destructive', onPress: () => deleteMenu(id) }]);
  const confirmDeleteStock = (id: string, name: string) => Alert.alert('Hapus bahan?', `${name} akan dihapus dari daftar bahan baku.`, [{ text: 'Batal', style: 'cancel' }, { text: 'Hapus', style: 'destructive', onPress: () => deleteInventoryItem(id) }]);
  const uploadConsignmentImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85, base64: true });
      if (!result.canceled && result.assets[0]?.uri) {
        setConsignmentImageUri(await persistImageAsset(result.assets[0]));
      }
    } catch {
      Alert.alert('Gambar tidak tersedia', 'Gambar tidak bisa dibuka. Coba pilih gambar lain.');
    }
  };
  const saveConsignment = () => {
    const cost = Number(consignmentCost);
    const sellPrice = Number(consignmentSellPrice);
    const packSize = Number(consignmentPackSize);
    const packCount = Number(consignmentQty);
    if (!consignmentName.trim() || !Number.isFinite(cost) || !Number.isFinite(sellPrice) || !Number.isFinite(packSize) || !Number.isFinite(packCount) || cost < 0 || sellPrice < 0 || packSize <= 0 || !Number.isInteger(packSize) || packCount < 0 || !Number.isInteger(packCount)) {
      return Alert.alert('Titipan belum lengkap', 'Isi nama, harga per plastik, isi plastik, harga jual per biji, dan jumlah plastik dengan benar.');
    }
    // The form edits whole packs. Keep pieces already sold from a partial pack
    // instead of silently rounding the saved stock down on an unrelated edit.
    const quantity = packCount * packSize;
    addConsignment(consignmentName.trim(), cost, sellPrice, quantity, packSize, consignmentImageUri);
    resetConsignment();
  };
  const confirmDeleteConsignment = (id: string, name: string) => Alert.alert('Hapus titipan?', `${name} akan dihapus dari daftar titipan.`, [{ text: 'Batal', style: 'cancel' }, { text: 'Hapus', style: 'destructive', onPress: () => deleteConsignment(id) }]);

  const getRemainingPortions = (recipe: Record<string, number>) => {
    const ingredients = Object.entries(recipe);
    if (!ingredients.length) return null;
    return Math.min(...ingredients.map(([id, required]) => {
      const available = inventory.find((item) => item.id === id)?.qty ?? 0;
      return required > 0 ? Math.floor(available / required) : Number.POSITIVE_INFINITY;
    }));
  };
  return (
    <Screen
      footerBorder={false}
      footer={section === 'overview' ? undefined : (
        <View style={s.actionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={section === 'menus' ? 'Tambah menu' : section === 'ingredients' ? 'Tambah bahan baku' : 'Tambah barang titipan'}
            onPress={() => section === 'menus' ? setMenuOpen(true) : section === 'ingredients' ? setStockOpen(true) : setConsignmentOpen(true)}
            style={({ pressed }) => [s.action, { backgroundColor: section === 'menus' ? c.primary : section === 'ingredients' ? c.accent : c.secondary, borderColor: section === 'menus' ? c.primary : section === 'ingredients' ? c.accent : c.border, opacity: pressed ? 0.75 : 1 }]}
          >
            <Ionicons name={section === 'menus' ? 'restaurant-outline' : section === 'ingredients' ? 'cube-outline' : 'storefront-outline'} size={17} color={section === 'menus' ? c.primaryForeground : section === 'ingredients' ? c.accentForeground : c.secondaryForeground} />
          </Pressable>
        </View>
      )}
    >
      <PageHeader
        eyebrow="Katalog & persediaan"
        title={section === 'overview' ? 'Stok' : section === 'menus' ? 'Daftar menu' : section === 'ingredients' ? 'Bahan baku' : 'Barang titipan'}
        subtitle={section === 'overview' ? 'Akses cepat untuk mengatur semua persediaan warung.' : section === 'menus' ? 'Atur menu yang tampil saat menerima pesanan.' : section === 'ingredients' ? 'Pantau bahan dan batas aman persediaan.' : 'Kelola stok, harga, dan keuntungan barang titipan.'}
        backRoute="/"
        action={
          <View style={s.inventoryHeaderActions}>
            {section !== 'overview' ? <Pressable accessibilityRole="button" accessibilityLabel="Kembali ke ringkasan stok" onPress={() => setSection('overview')} style={({ pressed }) => [s.backButton, { backgroundColor: c.primaryForeground, opacity: pressed ? 0.72 : 1 }]}><Ionicons name="arrow-back" size={20} color={c.primary} /></Pressable> : null}
            <ThemeActions />
            <View style={[s.headingIcon, { backgroundColor: c.primaryForeground }]}>
              <Ionicons name={section === 'overview' ? 'layers-outline' : section === 'menus' ? 'restaurant-outline' : section === 'ingredients' ? 'cube-outline' : 'storefront-outline'} size={22} color={c.primary} />
            </View>
          </View>
        }
      />
      <Surface tone="ink" style={s.summary}>
        <View>
          <Text style={[s.summaryLabel, { color: c.mutedForeground }]}>{section === 'overview' ? 'TOTAL SEMUA ITEM' : section === 'menus' ? 'MENU AKTIF' : section === 'ingredients' ? 'BAHAN TERSIMPAN' : 'BARANG TITIPAN'}</Text>
          <Text style={[s.summaryValue, { color: c.card }]}>{section === 'overview' ? menus.length + inventory.length + consignments.length : section === 'menus' ? menus.length : section === 'ingredients' ? inventory.length : consignments.length}</Text>
          <Text style={[s.summarySub, { color: c.mutedForeground }]}>{section === 'overview' ? `${menus.length} menu  ·  ${inventory.length} bahan  ·  ${consignments.length} titipan` : section === 'menus' ? 'Menu siap dipilih di dapur' : section === 'ingredients' ? `${lowCount ? `${lowCount} perlu diisi` : 'Semua stok aman'}` : 'Stok titipan aktif'}</Text>
        </View>
        <View style={[s.summaryCircle, { backgroundColor: c.accent }]}>
          <Ionicons name={section === 'ingredients' && lowCount ? 'warning-outline' : section === 'overview' ? 'layers-outline' : 'checkmark-circle-outline'} size={25} color={c.accentForeground} />
        </View>
      </Surface>
       {lowCount > 0 ? (
         <Surface style={[s.alertCard, { borderColor: c.destructive, backgroundColor: c.accent }]}>
           <View style={[s.alertIcon, { backgroundColor: c.destructive }]}>
             <Ionicons name="warning-outline" size={19} color={c.destructiveForeground} />
           </View>
           <View style={s.flex}>
             <Text style={[s.alertTitle, { color: c.foreground }]}>{lowCount} stok perlu diisi</Text>
             <Text style={[s.alertBody, { color: c.mutedForeground }]}>
               {inventory.filter((item) => item.qty <= item.safe).slice(0, 3).map((item) => item.name).join(' · ')}
               {lowCount > 3 ? ' · dan lainnya' : ''}
             </Text>
           </View>
           {section === 'overview' ? <Pressable accessibilityRole="button" accessibilityLabel="Buka bahan yang perlu diisi" onPress={() => setSection('ingredients')}><Ionicons name="chevron-forward" size={19} color={c.foreground} /></Pressable> : null}
         </Surface>
       ) : null}
       {section === 'overview' ? <><SectionHeader title="Akses cepat" meta="Pilih kategori" icon="flash-outline" />
         <View style={s.quickAccessGrid}>
           <Pressable accessibilityRole="button" accessibilityLabel={`Buka daftar menu, ${menus.length} item`} onPress={() => setSection('menus')} style={({ pressed }) => [s.quickAccess, s.quickAccessTile, { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.78 : 1 }]}>
             <View style={[s.quickAccessIcon, { backgroundColor: c.secondary }]}><Ionicons name="restaurant-outline" size={23} color={c.primary} /></View>
             <View style={s.quickAccessCopy}><Text style={[s.quickAccessTitle, { color: c.foreground }]}>Daftar menu</Text><Text style={[s.quickAccessMeta, { color: c.mutedForeground }]}>{menus.length} tersimpan</Text></View>
             <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} style={s.quickAccessChevron} />
           </Pressable>
           <Pressable accessibilityRole="button" accessibilityLabel={`Buka bahan baku, ${inventory.length} item`} onPress={() => setSection('ingredients')} style={({ pressed }) => [s.quickAccess, s.quickAccessTile, { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.78 : 1 }]}>
             <View style={[s.quickAccessIcon, { backgroundColor: c.accent }]}><Ionicons name="cube-outline" size={23} color={c.accentForeground} /></View>
             <View style={s.quickAccessCopy}><Text style={[s.quickAccessTitle, { color: c.foreground }]}>Bahan baku</Text><Text style={[s.quickAccessMeta, { color: c.mutedForeground }]}>{inventory.length} tersimpan</Text></View>
             <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} style={s.quickAccessChevron} />
           </Pressable>
           <Pressable accessibilityRole="button" accessibilityLabel={`Buka barang titipan, ${consignments.length} item`} onPress={() => setSection('consignments')} style={({ pressed }) => [s.quickAccess, s.quickAccessTile, { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.78 : 1 }]}>
             <View style={[s.quickAccessIcon, { backgroundColor: c.secondary }]}><Ionicons name="storefront-outline" size={23} color={c.primary} /></View>
             <View style={s.quickAccessCopy}><Text style={[s.quickAccessTitle, { color: c.foreground }]}>Titipan</Text><Text style={[s.quickAccessMeta, { color: c.mutedForeground }]}>{consignments.length} tersimpan</Text></View>
             <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} style={s.quickAccessChevron} />
           </Pressable>
         </View>
       </> : null}
       {section === 'menus' ? <><SectionHeader title="Daftar menu" meta={`${menus.length} item`} icon="restaurant-outline" />
         {!menus.length ? <EmptyState icon="restaurant-outline" title="Belum ada menu" body="Buat daftar menu warung melalui tombol di atas." /> : menus.map((menu) => { const remaining = getRemainingPortions(menu.recipe); return <Surface key={menu.id} style={s.item}><View style={s.inventoryImage}>{menu.imageUri ? <Image source={{ uri: menu.imageUri }} style={s.imageFill} /> : <Ionicons name={menu.category === 'Minuman' ? 'cafe-outline' : 'fast-food-outline'} size={19} color={c.primary} />}</View><View style={s.flex}><Text style={[s.name, { color: c.foreground }]}>{menu.name}</Text><Text style={[s.category, { color: c.primary }]}>{menu.category || 'Lainnya'}</Text><Text style={[s.sub, { color: c.mutedForeground }]}>{menu.price.toLocaleString('id-ID')}</Text><Text style={[s.recipe, { color: remaining === 0 ? c.destructive : c.primary }]}>{remaining === null ? 'Sisa belum dihitung — atur resep stok' : `Sisa ${remaining} porsi`}</Text></View><View style={s.itemActions}><IconButton icon="trash-outline" label={`Hapus ${menu.name}`} onPress={() => confirmDelete(menu.id, menu.name)} /></View></Surface>; })}
       </> : null}
        {section === 'ingredients' ? <><Pressable accessibilityRole="button" accessibilityLabel="Catat stok masuk" onPress={() => { setRestockItemId(inventory[0]?.id ?? ''); setRestockOpen(true); }} style={({ pressed }) => [s.stockInButton, { backgroundColor: c.primary, opacity: pressed ? 0.76 : 1 }]}>
          <Ionicons name="download-outline" size={18} color={c.primaryForeground} />
          <View style={s.flex}><Text style={[s.stockInTitle, { color: c.primaryForeground }]}>Catat stok masuk</Text><Text style={[s.stockInBody, { color: c.primaryForeground + 'CC' }]}>Tambahkan jumlah dan simpan sumbernya.</Text></View>
          <Ionicons name="chevron-forward" size={18} color={c.primaryForeground} />
        </Pressable><SectionHeader title="Bahan baku" meta={lowCount ? `${lowCount} perlu diisi` : `${inventory.length} item`} icon="cube-outline" />
        {!inventory.length ? <EmptyState icon="cube-outline" title="Belum ada stok" body="Tambahkan bahan baku, satuan, dan batas aman." /> : inventory.map((item) => {
          const low = item.qty <= item.safe;
          return <Surface key={item.id} style={[s.item, { borderColor: low ? c.destructive : c.border }]}>
            <View style={[s.itemIcon, { backgroundColor: low ? c.muted : c.secondary }]}><Ionicons name="cube-outline" size={19} color={low ? c.destructive : c.primary} /></View>
            <View style={s.flex}><Text style={[s.name, { color: c.foreground }]}>{item.name}</Text><Text style={[s.sub, { color: c.mutedForeground }]}>Batas aman {item.safe} {item.unit}</Text></View>
            <View style={s.stockRight}><Text style={[s.stockQty, { color: low ? c.destructive : c.foreground }]}>{item.qty}</Text><Text style={[s.sub, { color: c.mutedForeground }]}>{item.unit}</Text></View>
            {low ? <View accessibilityLabel={`Stok ${item.name} menipis`} style={s.lowIndicator}><Ionicons name="warning" size={19} color={c.destructive} /></View> : null}
              <View style={s.stockControls}>
              <Pressable accessibilityLabel={`Kurangi stok ${item.name}`} disabled={item.qty <= 0} onPress={() => removeStock(item.id, 1)} style={({ pressed }) => [s.minus, { backgroundColor: c.secondary, opacity: item.qty <= 0 ? 0.4 : pressed ? 0.65 : 1 }]}><Ionicons name="remove" size={17} color={c.secondaryForeground} /></Pressable>
              <Pressable accessibilityLabel={`Tambah stok ${item.name}`} onPress={() => addStock(item.id, 1)} style={({ pressed }) => [s.plus, { backgroundColor: c.primary, opacity: pressed ? 0.7 : 1 }]}><Ionicons name="add" size={17} color={c.primaryForeground} /></Pressable>
              <IconButton icon="trash-outline" label={`Hapus bahan ${item.name}`} onPress={() => confirmDeleteStock(item.id, item.name)} />
             </View>
          </Surface>;
          })}
          {stockMovements.length ? <><SectionHeader title="Riwayat stok masuk" meta={`${stockMovements.length} catatan`} icon="time-outline" />{stockMovements.slice().reverse().slice(0, 5).map((movement) => { const item = inventory.find((entry) => entry.id === movement.inventoryId); return <Surface key={movement.id} style={s.movement}><View style={[s.movementIcon, { backgroundColor: c.secondary }]}><Ionicons name="download-outline" size={17} color={c.primary} /></View><View style={s.flex}><Text style={[s.movementTitle, { color: c.foreground }]}>+{movement.quantity} {movement.unit} {item?.name ?? 'Bahan'}</Text><Text style={[s.movementMeta, { color: c.mutedForeground }]}>{movement.reason ?? 'Stok masuk'} · {movement.date.split('-').reverse().join('/')}</Text></View></Surface>; })}</> : null}
          </> : null}
       {section === 'consignments' ? <><SectionHeader title="Barang titipan" meta={`${consignments.length} item`} icon="storefront-outline" />
        {!consignments.length ? <EmptyState icon="storefront-outline" title="Belum ada barang titipan" body="Catat barang milik penitip untuk melihat biaya, harga jual, dan keuntungan." /> : consignments.map((item) => {
           const packSize = item.packSize || 1;
           const costPerPiece = item.cost / packSize;
           const profit = item.sellPrice - costPerPiece;
          return <Surface key={item.id} style={s.item}>
             <View style={[s.itemIcon, { backgroundColor: c.secondary }]}>{item.imageUri ? <Image source={{ uri: item.imageUri }} style={s.imageFill} /> : <Ionicons name="storefront-outline" size={19} color={c.primary} />}</View>
            <View style={s.flex}>
              <Text style={[s.name, { color: c.foreground }]}>{item.name}</Text>
               <Text style={[s.sub, { color: c.mutedForeground }]}>Stok {Math.floor(item.qty / packSize)} plastik  ·  {item.qty} biji ({packSize} biji / plastik)</Text>
               <Text style={[s.sub, { color: c.mutedForeground }]}>Bayar penitip {costPerPiece.toLocaleString('id-ID', { maximumFractionDigits: 2 })} / biji  ·  Jual {item.sellPrice.toLocaleString('id-ID')} / biji</Text>
               <Text style={[s.profit, { color: profit >= 0 ? c.primary : c.destructive }]}>Untung {profit.toLocaleString('id-ID', { maximumFractionDigits: 2 })} / biji  ·  Total 1 plastik {((item.sellPrice * packSize) - item.cost).toLocaleString('id-ID', { maximumFractionDigits: 2 })}</Text>
            </View>
            <View style={s.consignmentActions}>
              <Pressable accessibilityLabel={`Kurangi 1 plastik titipan ${item.name}`} disabled={item.qty < packSize} onPress={() => removeConsignmentStock(item.id, packSize)} style={({ pressed }) => [s.minus, { backgroundColor: c.secondary, opacity: item.qty < packSize ? 0.4 : pressed ? 0.65 : 1 }]}><Ionicons name="remove" size={17} color={c.secondaryForeground} /></Pressable>
              <Pressable accessibilityLabel={`Tambah 1 plastik titipan ${item.name}`} onPress={() => addConsignmentStock(item.id, packSize)} style={({ pressed }) => [s.plus, { backgroundColor: c.primary, opacity: pressed ? 0.7 : 1 }]}><Ionicons name="add" size={17} color={c.primaryForeground} /></Pressable>
              <IconButton icon="trash-outline" label={`Hapus titipan ${item.name}`} onPress={() => confirmDeleteConsignment(item.id, item.name)} />
            </View>
          </Surface>;
         })}</> : null}
       <Text style={[s.info, { color: c.mutedForeground }]}><Ionicons name="information-circle-outline" size={15} color={c.primary} />  {section === 'overview' ? 'Pilih kategori untuk membuka halaman detail.' : section === 'menus' ? 'Gunakan tombol lingkaran di bawah untuk menambah menu.' : section === 'ingredients' ? 'Gunakan tombol lingkaran di bawah untuk menambah bahan.' : 'Gunakan tombol lingkaran di bawah untuk menambah titipan.'}</Text>

          <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={resetMenu}><View style={[s.backdrop, { backgroundColor: c.foreground + 'B8' }]}><KeyboardAwareScrollViewCompat style={s.modalScroll} contentContainerStyle={s.modalScrollContent} keyboardShouldPersistTaps="handled" bottomOffset={20}><View style={[s.modal, { backgroundColor: c.card }]}><View style={s.modalHead}><View><Text style={[s.modalKicker, { color: c.primary }]}>KATALOG BARU</Text><Text style={[s.modalTitle, { color: c.foreground }]}>{editingMenuId ? 'Edit menu' : 'Buat menu'}</Text></View><Pressable accessibilityLabel="Tutup buat menu" hitSlop={12} onPress={resetMenu}><Ionicons name="close-circle" size={27} color={c.mutedForeground} /></Pressable></View><Text style={[s.label, { color: c.mutedForeground }]}>Nama menu</Text><TextInput value={menuName} onChangeText={setMenuName} returnKeyType="next" autoCapitalize="words" placeholder="Contoh: Mie Yamin" placeholderTextColor={c.mutedForeground} selectionColor={c.primary} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} /><Text style={[s.label, { color: c.mutedForeground }]}>Kategori</Text><View style={s.categoryOptions}>{['Bakso', 'Mie ayam', 'Minuman', 'Lainnya'].map((category) => <Pressable key={category} onPress={() => setMenuCategory(category)} style={[s.categoryOption, { backgroundColor: menuCategory === category ? c.primary : c.secondary }]}><Text style={[s.categoryOptionText, { color: menuCategory === category ? c.primaryForeground : c.secondaryForeground }]}>{category}</Text></Pressable>)}</View><TextInput value={menuCategory} onChangeText={setMenuCategory} autoCapitalize="words" placeholder="Atau tulis kategori sendiri" placeholderTextColor={c.mutedForeground} selectionColor={c.primary} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} /><Text style={[s.label, { color: c.mutedForeground }]}>Gambar menu</Text><Pressable onPress={uploadMenuImage} style={({ pressed }) => [s.imagePicker, { borderColor: c.primary, backgroundColor: c.secondary, opacity: pressed ? 0.7 : 1 }]}>{menuImageUri ? <Image source={{ uri: menuImageUri }} style={s.pickerImage} /> : <Ionicons name="image-outline" size={25} color={c.primary} />}<View style={s.flex}><Text style={[s.imagePickerTitle, { color: c.foreground }]}>{menuImageUri ? 'Ganti gambar menu' : 'Unggah gambar menu'}</Text><Text style={[s.recipeHint, { color: c.mutedForeground }]}>Opsional · gunakan gambar standar jika kosong</Text></View></Pressable><Text style={[s.label, { color: c.mutedForeground }]}>Harga jual</Text><TextInput value={menuPrice} onChangeText={setMenuPrice} keyboardType="number-pad" returnKeyType="done" placeholder="Contoh: 18000" placeholderTextColor={c.mutedForeground} selectionColor={c.primary} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} /><Text style={[s.label, { color: c.mutedForeground }]}>Bahan yang dipakai per porsi</Text><Text style={[s.recipeHint, { color: c.mutedForeground }]}>Atur jumlah pemakaian. Tekan tambah beberapa kali untuk lebih dari 1.</Text>{!inventory.length ? <Text style={[s.recipeHint, { color: c.mutedForeground }]}>Tambahkan bahan stok terlebih dahulu di menu Tambah stok.</Text> : inventory.map((item) => { const quantity = Number(recipeDraft[item.id]) || 0; return <View key={item.id} style={[s.recipeRow, { borderColor: c.border }]}><View style={s.flex}><Text style={[s.name, { color: c.foreground }]}>{item.name}</Text><Text style={[s.sub, { color: c.mutedForeground }]}>tersedia {item.qty} {item.unit}</Text></View><Pressable accessibilityLabel={`Kurangi ${item.name} dari resep`} onPress={() => updateRecipeQuantity(item.id, -1)} style={[s.recipeButton, { backgroundColor: c.secondary }]}><Ionicons name="remove" size={16} color={c.secondaryForeground} /></Pressable><Text style={[s.recipeQuantity, { color: c.foreground }]}>{quantity} {item.unit}</Text><Pressable accessibilityLabel={`Tambah ${item.name} ke resep`} onPress={() => updateRecipeQuantity(item.id, 1)} style={[s.recipeButton, { backgroundColor: c.primary }]}><Ionicons name="add" size={16} color={c.primaryForeground} /></Pressable></View>; })}<PrimaryButton testID="save-menu" onPress={saveMenu} icon="checkmark-circle-outline">Simpan menu</PrimaryButton></View></KeyboardAwareScrollViewCompat></View></Modal>
          <Modal visible={stockOpen} transparent animationType="slide" onRequestClose={resetStock}><View style={[s.backdrop, { backgroundColor: c.foreground + 'B8' }]}><KeyboardAwareScrollViewCompat contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled" bottomOffset={20}><View style={[s.modal, { backgroundColor: c.card }]}><View style={s.modalHead}><View><Text style={[s.modalKicker, { color: c.primary }]}>{editingStockId ? 'EDIT BAHAN' : 'PERSEDIAAN BARU'}</Text><Text style={[s.modalTitle, { color: c.foreground }]}>{editingStockId ? 'Edit bahan stok' : 'Tambah bahan stok'}</Text></View><Pressable accessibilityLabel="Tutup bahan stok" onPress={resetStock}><Ionicons name="close-circle" size={27} color={c.mutedForeground} /></Pressable></View><Text style={[s.label, { color: c.mutedForeground }]}>Nama bahan</Text><TextInput autoFocus value={stockName} onChangeText={setStockName} returnKeyType="next" autoCapitalize="words" placeholder="Contoh: Mi telur" placeholderTextColor={c.mutedForeground} selectionColor={c.primary} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} /><View style={s.row}><View style={s.half}><Text style={[s.label, { color: c.mutedForeground }]}>Satuan</Text><TextInput value={unit} onChangeText={setUnit} returnKeyType="next" autoCapitalize="none" placeholder="kg / pcs" placeholderTextColor={c.mutedForeground} selectionColor={c.primary} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} /></View><View style={s.half}><Text style={[s.label, { color: c.mutedForeground }]}>Jumlah awal</Text><TextInput value={stockQty} onChangeText={setStockQty} keyboardType="number-pad" returnKeyType="next" placeholder="0" placeholderTextColor={c.mutedForeground} selectionColor={c.primary} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} /></View></View><Text style={[s.label, { color: c.mutedForeground }]}>Harga beli per satuan</Text><TextInput value={stockCost} onChangeText={setStockCost} keyboardType="number-pad" returnKeyType="next" placeholder="Contoh: 2500" placeholderTextColor={c.mutedForeground} selectionColor={c.primary} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} /><Text style={[s.recipeHint, { color: c.mutedForeground }]}>Dipakai untuk menghitung HPP menu dari resep.</Text><Text style={[s.label, { color: c.mutedForeground }]}>Batas aman stok</Text><TextInput value={safe} onChangeText={setSafe} keyboardType="number-pad" returnKeyType="done" placeholder="Contoh: 10" placeholderTextColor={c.mutedForeground} selectionColor={c.primary} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} /><PrimaryButton testID="save-stock" onPress={saveStock} icon="checkmark-outline">{editingStockId ? 'Simpan perubahan' : 'Simpan bahan'}</PrimaryButton></View></KeyboardAwareScrollViewCompat></View></Modal>
           <Modal visible={restockOpen} transparent animationType="slide" onRequestClose={resetRestock}><View style={[s.backdrop, { backgroundColor: c.foreground + 'B8' }]}><KeyboardAwareScrollViewCompat style={s.modalScroll} contentContainerStyle={s.modalScrollContent} keyboardShouldPersistTaps="handled" bottomOffset={20}><View style={[s.modal, { backgroundColor: c.card }]}><View style={s.modalHead}><View><Text style={[s.modalKicker, { color: c.primary }]}>PERSEDIAAN</Text><Text style={[s.modalTitle, { color: c.foreground }]}>Catat stok masuk</Text></View><Pressable accessibilityLabel="Tutup stok masuk" hitSlop={12} onPress={resetRestock}><Ionicons name="close-circle" size={27} color={c.mutedForeground} /></Pressable></View><Text style={[s.label, { color: c.mutedForeground }]}>Pilih bahan</Text><View style={s.stockOptions}>{inventory.map((item) => <Pressable key={item.id} onPress={() => setRestockItemId(item.id)} style={[s.stockOption, { backgroundColor: restockItemId === item.id ? c.primary : c.secondary, borderColor: restockItemId === item.id ? c.primary : c.border }]}><Text style={[s.stockOptionText, { color: restockItemId === item.id ? c.primaryForeground : c.foreground }]}>{item.name}</Text><Text style={[s.stockOptionMeta, { color: restockItemId === item.id ? c.primaryForeground + 'CC' : c.mutedForeground }]}>{item.qty} {item.unit} saat ini</Text></Pressable>)}</View><Text style={[s.label, { color: c.mutedForeground }]}>Jumlah masuk</Text><TextInput testID="restock-quantity-input" autoFocus value={restockQty} onChangeText={setRestockQty} keyboardType="decimal-pad" placeholder="Contoh: 10" placeholderTextColor={c.mutedForeground} selectionColor={c.primary} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} /><Text style={[s.label, { color: c.mutedForeground }]}>Sumber / catatan (opsional)</Text><TextInput testID="restock-reason-input" value={restockReason} onChangeText={setRestockReason} placeholder="Contoh: Belanja pasar pagi" placeholderTextColor={c.mutedForeground} selectionColor={c.primary} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} /><PrimaryButton testID="save-restock" onPress={saveRestock} icon="download-outline">Simpan stok masuk</PrimaryButton></View></KeyboardAwareScrollViewCompat></View></Modal>
           <Modal visible={consignmentOpen} transparent animationType="slide" onRequestClose={resetConsignment}><View style={[s.backdrop, { backgroundColor: c.foreground + 'B8' }]}><KeyboardAwareScrollViewCompat style={s.modalScroll} contentContainerStyle={s.modalScrollContent} keyboardShouldPersistTaps="handled" bottomOffset={20}><View style={[s.modal, { backgroundColor: c.card }]}><View style={s.modalHead}><View><Text style={[s.modalKicker, { color: c.primary }]}>{editingConsignmentId ? 'EDIT TITIPAN' : 'TITIPAN BARU'}</Text><Text style={[s.modalTitle, { color: c.foreground }]}>{editingConsignmentId ? 'Edit barang titipan' : 'Tambah barang titipan'}</Text></View><Pressable accessibilityLabel="Tutup titipan" hitSlop={12} onPress={resetConsignment}><Ionicons name="close-circle" size={27} color={c.mutedForeground} /></Pressable></View><Text style={[s.label, { color: c.mutedForeground }]}>Nama barang</Text><TextInput autoFocus value={consignmentName} onChangeText={setConsignmentName} returnKeyType="next" autoCapitalize="words" placeholder="Contoh: Kerupuk" placeholderTextColor={c.mutedForeground} selectionColor={c.primary} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} /><Text style={[s.label, { color: c.mutedForeground }]}>Gambar titipan</Text><Pressable accessibilityRole="button" accessibilityLabel={consignmentImageUri ? 'Ganti gambar titipan' : 'Upload gambar titipan'} onPress={uploadConsignmentImage} style={({ pressed }) => [s.imagePicker, { borderColor: c.primary, backgroundColor: c.secondary, opacity: pressed ? 0.7 : 1 }]}>{consignmentImageUri ? <Image source={{ uri: consignmentImageUri }} style={s.pickerImage} /> : <Ionicons name="image-outline" size={25} color={c.primary} />}<View style={s.flex}><Text style={[s.imagePickerTitle, { color: c.foreground }]}>{consignmentImageUri ? 'Ganti gambar titipan' : 'Upload gambar titipan'}</Text><Text style={[s.recipeHint, { color: c.mutedForeground }]}>Opsional · akan tampil di menu kasir</Text></View></Pressable><View style={s.row}><View style={s.half}><Text style={[s.label, { color: c.mutedForeground }]}>Harga penitip / plastik</Text><TextInput value={consignmentCost} onChangeText={setConsignmentCost} keyboardType="number-pad" returnKeyType="next" placeholder="Contoh: 10000" placeholderTextColor={c.mutedForeground} selectionColor={c.primary} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} /></View><View style={s.half}><Text style={[s.label, { color: c.mutedForeground }]}>Isi / plastik (biji)</Text><TextInput value={consignmentPackSize} onChangeText={setConsignmentPackSize} keyboardType="number-pad" returnKeyType="next" placeholder="10" placeholderTextColor={c.mutedForeground} selectionColor={c.primary} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} /></View></View><Text style={[s.label, { color: c.mutedForeground }]}>Harga jual / biji</Text><TextInput value={consignmentSellPrice} onChangeText={setConsignmentSellPrice} keyboardType="number-pad" returnKeyType="next" placeholder="Contoh: 1500" placeholderTextColor={c.mutedForeground} selectionColor={c.primary} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} /><Text style={[s.label, { color: c.mutedForeground }]}>Jumlah stok titipan (plastik)</Text><TextInput value={consignmentQty} onChangeText={setConsignmentQty} keyboardType="number-pad" returnKeyType="done" placeholder="Contoh: 5" placeholderTextColor={c.mutedForeground} selectionColor={c.primary} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} /><Text style={[s.recipeHint, { color: c.mutedForeground }]}>Isi jumlah plastik yang dititipkan. Stok akan dikonversi otomatis ke biji saat barang dijual.</Text><View style={[s.calculationBox, { backgroundColor: c.secondary, borderColor: c.border }]}><Text style={[s.calculationTitle, { color: c.foreground }]}>Perhitungan otomatis</Text><Text style={[s.calculationText, { color: c.mutedForeground }]}>Bayar penitip / biji: Rp {(Number(consignmentPackSize) > 0 ? Number(consignmentCost) / Number(consignmentPackSize) : 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })}</Text><Text style={[s.calculationText, { color: c.primary }]}>Keuntungan / biji: Rp {(Number(consignmentSellPrice) - (Number(consignmentPackSize) > 0 ? Number(consignmentCost) / Number(consignmentPackSize) : 0)).toLocaleString('id-ID', { maximumFractionDigits: 2 })}</Text></View><PrimaryButton testID="save-consignment" onPress={saveConsignment} icon="checkmark-circle-outline">{editingConsignmentId ? 'Simpan perubahan' : 'Simpan titipan'}</PrimaryButton></View></KeyboardAwareScrollViewCompat></View></Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  inventoryHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headingIcon: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '4deg' }] },
  summary: { minHeight: 126, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 17 },
  summaryLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  summaryValue: { fontSize: 35, fontWeight: '800', marginTop: 4 },
  summarySub: { fontSize: 12, marginTop: 3 },
  summaryCircle: { width: 54, height: 54, borderRadius: 19, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }] },
  alertCard: { minHeight: 66, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 17 },
  alertIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontSize: 13, fontWeight: '800' },
  alertBody: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  action: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 4px 8px rgba(10, 10, 10, 0.16)', elevation: 5 },
  quickAccess: { minHeight: 72, borderWidth: 1, borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  quickAccessGrid: { flexDirection: 'row', gap: 8 },
  quickAccessTile: { flex: 1, minHeight: 118, padding: 9, flexDirection: 'column', justifyContent: 'center', marginBottom: 0 },
  quickAccessIcon: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  quickAccessCopy: { width: '100%', alignItems: 'center' },
  quickAccessTitle: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  quickAccessMeta: { fontSize: 9, marginTop: 4, textAlign: 'center' },
  quickAccessChevron: { position: 'absolute', top: 8, right: 8 },
  item: { minHeight: 64, padding: 11, flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  itemIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  flex: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700' },
  category: { fontSize: 10, fontWeight: '800', marginTop: 4 },
  inventoryImage: { width: 43, height: 43, borderRadius: 14, backgroundColor: '#DDF3E8', alignItems: 'center', justifyContent: 'center', marginRight: 10, overflow: 'hidden' },
  imageFill: { width: '100%', height: '100%' },
  sub: { fontSize: 11, marginTop: 3 },
  recipe: { fontSize: 11, lineHeight: 17, marginTop: 6, fontWeight: '700' },
  stockRight: { alignItems: 'flex-end', marginRight: 8 },
  stockQty: { fontSize: 17, fontWeight: '800' },
  stockControls: { flexDirection: 'row', gap: 6, marginLeft: 8 },
  stockInButton: { minHeight: 63, borderRadius: 17, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 17 },
  stockInTitle: { fontSize: 13, fontWeight: '800' },
  stockInBody: { fontSize: 10, marginTop: 3 },
  stockOptions: { gap: 7, marginBottom: 3 },
  stockOption: { borderWidth: 1, borderRadius: 13, padding: 10 },
  stockOptionText: { fontSize: 12, fontWeight: '800' },
  stockOptionMeta: { fontSize: 10, marginTop: 3 },
  movement: { minHeight: 58, padding: 11, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  movementIcon: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  movementTitle: { fontSize: 12, fontWeight: '800' },
  movementMeta: { fontSize: 10, marginTop: 3 },
  safeInput: { width: 48, height: 30, borderWidth: 1, borderRadius: 10, paddingHorizontal: 5, fontSize: 12, textAlign: 'center' },
  saveInline: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  consignmentActions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
  profit: { fontSize: 11, lineHeight: 17, marginTop: 5, fontWeight: '700' },
  calculationBox: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 8, marginBottom: 12 },
  calculationTitle: { fontSize: 12, fontWeight: '800', marginBottom: 5 },
  calculationText: { fontSize: 11, lineHeight: 18 },
  lowIndicator: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginLeft: 5 },
  minus: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  plus: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  info: { fontSize: 12, lineHeight: 19, marginTop: 5 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  modalScroll: { flexGrow: 0, maxHeight: '88%' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'flex-end' },
  recipeHint: { fontSize: 11, lineHeight: 17, marginBottom: 5 },
  recipeRow: { minHeight: 52, borderWidth: 1, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  recipeButton: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  recipeQuantity: { minWidth: 45, textAlign: 'center', fontSize: 11, fontWeight: '800' },
  categoryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  categoryOption: { borderRadius: 12, paddingVertical: 9, paddingHorizontal: 11 },
  categoryOptionText: { fontSize: 11, fontWeight: '800' },
  imagePicker: { minHeight: 68, borderWidth: 1, borderRadius: 15, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  pickerImage: { width: 48, height: 48, borderRadius: 13 },
  imagePickerTitle: { fontSize: 13, fontWeight: '800' },
  modal: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 35 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  modalKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  modalTitle: { fontSize: 23, fontWeight: '800', marginTop: 3 },
  label: { fontSize: 11, fontWeight: '800', marginBottom: 7, marginTop: 8 },
  input: { height: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontSize: 14, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 9 },
  half: { flex: 1 },
});