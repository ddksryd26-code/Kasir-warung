import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, PageHeader, Screen, Surface } from '@/components/WarungUI';
import { formatRp, useWarung } from '@/context/WarungContext';
import { NoteCategory, NoteItem, ShoppingDay, useNotes } from '@/context/NotesContext';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

const categoryOptions: Array<{ id: NoteCategory; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; helper: string }> = [
  { id: 'shopping', label: 'Belanja', icon: 'cart-outline', helper: 'Atur kebutuhan belanja hari ini dan besok.' },
  { id: 'carry', label: 'Perlu dibawa', icon: 'bag-handle-outline', helper: 'Barang yang harus dibawa saat berangkat.' },
  { id: 'general', label: 'Catatan biasa', icon: 'create-outline', helper: 'Catatan bebas untuk hal-hal penting.' },
];
const unitOptions = ['pcs', 'kg', 'liter', 'pack'];

export default function NotesScreen() {
  const c = useColors();
  const { addShoppingExpense } = useWarung();
  const { notes, addNote, addShoppingItem, toggleNote, toggleShoppingItem, deleteNote, deleteShoppingItem, setShoppingPrice, markShoppingExpenseRecorded, changeShoppingQuantity, clearShoppingCompleted, clearCompleted } = useNotes();
  const [selected, setSelected] = useState<NoteCategory>('shopping');
  const [shoppingDay, setShoppingDay] = useState<ShoppingDay>('tomorrow');
  const [shoppingName, setShoppingName] = useState('');
  const [shoppingQuantity, setShoppingQuantity] = useState('1');
  const [shoppingUnit, setShoppingUnit] = useState('pcs');
  const [composerVisible, setComposerVisible] = useState(false);
  const [composerCategory, setComposerCategory] = useState<NoteCategory>('general');
  const [noteSubject, setNoteSubject] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [openedNote, setOpenedNote] = useState<{ item: NoteItem; category: NoteCategory } | null>(null);
  const option = categoryOptions.find((item) => item.id === selected) ?? categoryOptions[0];
  const shoppingItems = shoppingDay === 'today' ? notes.shoppingToday : notes.shoppingTomorrow;
  const activeNotes = selected === 'shopping' ? shoppingItems : notes[selected];
  const completedCount = activeNotes.filter((item) => item.done).length;
  const pendingNotes = useMemo(() => activeNotes.filter((item) => !item.done), [activeNotes]);
  const completedNotes = useMemo(() => activeNotes.filter((item) => item.done), [activeNotes]);

  const openComposer = () => {
    setComposerCategory(selected === 'shopping' ? 'general' : selected);
    setNoteSubject('');
    setNoteBody('');
    setComposerVisible(true);
  };

  const closeComposer = () => {
    setComposerVisible(false);
    setNoteSubject('');
    setNoteBody('');
  };

  const submit = () => {
    const subject = noteSubject.trim();
    const body = noteBody.trim();
    const text = [subject, body].filter(Boolean).join('\n');
    if (!text) return;
    addNote(composerCategory, text);
    closeComposer();
  };

  const submitShopping = () => {
    const quantity = Number.parseFloat(shoppingQuantity.replace(',', '.'));
    if (!shoppingName.trim() || !Number.isFinite(quantity) || quantity <= 0) return;
    addShoppingItem(shoppingDay, shoppingName, quantity, shoppingUnit);
    setShoppingName('');
    setShoppingQuantity('1');
  };

  const handleShoppingToggle = (day: ShoppingDay, item: NoteItem) => {
    if (day === 'today' && !item.done && !item.expenseRecorded) {
      if (!item.price || item.price <= 0) {
        Alert.alert('Harga belum diisi', 'Masukkan total harga belanja sebelum menandai barang sudah dibeli.');
        return;
      }
      addShoppingExpense(item.id, `Belanja hari ini · ${item.text}`, item.price);
      markShoppingExpenseRecorded(day, item.id);
    }
    toggleShoppingItem(day, item.id);
  };

  return (
      <Screen
        floatingAction={selected !== 'shopping' ? (
          <Pressable
            testID="add-note-fab"
            accessibilityRole="button"
            accessibilityLabel={`Tulis ${option.label.toLowerCase()} baru`}
            onPress={openComposer}
            style={({ pressed }) => [s.fab, { backgroundColor: c.primary, opacity: pressed ? 0.78 : 1 }]}
          >
            <Ionicons name="add" size={29} color={c.primaryForeground} />
          </Pressable>
        ) : null}
      >
      <PageHeader
        eyebrow="Ruang catatan"
        title="Catatan"
        subtitle="Simpan hal kecil yang membantu warung berjalan lebih lancar."
      />

      <View style={s.categoryTabs}>
        {categoryOptions.map((item) => {
          const active = item.id === selected;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setSelected(item.id)}
              style={({ pressed }) => [
                s.categoryTab,
                {
                  backgroundColor: active ? c.primary : c.card,
                  borderColor: active ? c.primary : c.border,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <Ionicons name={item.icon} size={17} color={active ? c.primaryForeground : c.mutedForeground} />
              <Text style={[s.categoryTabText, { color: active ? c.primaryForeground : c.mutedForeground }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {selected === 'shopping' ? (
        <ShoppingContent
          items={activeNotes}
          day={shoppingDay}
          onDayChange={setShoppingDay}
          name={shoppingName}
          quantity={shoppingQuantity}
          unit={shoppingUnit}
          onNameChange={setShoppingName}
          onQuantityChange={setShoppingQuantity}
          onUnitChange={setShoppingUnit}
          onSubmit={submitShopping}
          onDelete={deleteShoppingItem}
          onPriceChange={setShoppingPrice}
          onToggleItem={handleShoppingToggle}
          onChangeQuantity={changeShoppingQuantity}
          onClear={() => clearShoppingCompleted(shoppingDay)}
        />
      ) : (
      <>
      <View style={s.sectionHeading}>
        <View style={s.sectionCopy}>
          <View style={s.sectionTitleRow}>
            <Ionicons name="mail-open-outline" size={18} color={c.primary} />
            <Text style={[s.sectionTitle, { color: c.foreground }]}>{option.label}</Text>
          </View>
          <Text style={[s.sectionHelper, { color: c.mutedForeground }]}>{option.helper}</Text>
        </View>
        {completedCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bersihkan catatan selesai"
            onPress={() => clearCompleted(selected)}
            style={({ pressed }) => [s.clearButton, { borderColor: c.border, opacity: pressed ? 0.65 : 1 }]}
          >
            <Text style={[s.clearButtonText, { color: c.primary }]}>Bersihkan selesai</Text>
          </Pressable>
        ) : null}
      </View>

      {pendingNotes.length ? (
        <View style={s.noteList}>
          {pendingNotes.map((item) => (
            <NoteRow key={item.id} item={item} category={selected} onToggle={toggleNote} onDelete={deleteNote} onOpen={() => setOpenedNote({ item, category: selected })} />
          ))}
        </View>
      ) : (
        <EmptyState
          icon={option.icon}
          title={selected === 'carry' ? 'Belum ada barang bawaan' : 'Belum ada catatan'}
          body="Tekan tombol tambah di kanan bawah untuk menulis catatan."
        />
      )}

      {completedNotes.length ? (
        <View style={s.completedSection}>
          <Text style={[s.completedLabel, { color: c.mutedForeground }]}>SUDAH SELESAI · {completedNotes.length}</Text>
          {completedNotes.map((item) => (
            <NoteRow key={item.id} item={item} category={selected} onToggle={toggleNote} onDelete={deleteNote} onOpen={() => setOpenedNote({ item, category: selected })} />
          ))}
        </View>
      ) : null}
      </>
      )}
      <NoteComposerModal
        visible={composerVisible}
        category={composerCategory}
        subject={noteSubject}
        body={noteBody}
        onCategoryChange={setComposerCategory}
        onSubjectChange={setNoteSubject}
        onBodyChange={setNoteBody}
        onClose={closeComposer}
        onSubmit={submit}
      />
      <NoteDetailModal
        note={openedNote?.item ?? null}
        category={openedNote?.category ?? 'general'}
        onClose={() => setOpenedNote(null)}
      />
    </Screen>
  );
}

function NoteComposerModal({
  visible,
  category,
  subject,
  body,
  onCategoryChange,
  onSubjectChange,
  onBodyChange,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  category: NoteCategory;
  subject: string;
  body: string;
  onCategoryChange: (category: NoteCategory) => void;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const canSubmit = Boolean(subject.trim() || body.trim());
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View testID="note-compose-modal" style={[s.composeRoot, { backgroundColor: c.background }]}>
        <KeyboardAwareScrollViewCompat
          contentContainerStyle={[s.composeContent, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          bottomOffset={20}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.composeHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel="Tutup penulisan catatan" onPress={onClose} hitSlop={8} style={s.composeIconButton}>
              <Ionicons name="close" size={25} color={c.foreground} />
            </Pressable>
            <View style={s.composeHeaderCopy}>
              <Text style={[s.composeKicker, { color: c.primary }]}>CATATAN BARU</Text>
              <Text style={[s.composeTitle, { color: c.foreground }]}>Tulis catatan</Text>
            </View>
            <Pressable
              testID="save-note"
              accessibilityRole="button"
              accessibilityLabel="Simpan catatan"
              onPress={onSubmit}
              disabled={!canSubmit}
              style={({ pressed }) => [s.composeSendButton, { backgroundColor: canSubmit ? c.primary : c.muted, opacity: pressed ? 0.72 : 1 }]}
            >
              <Ionicons name="send" size={17} color={canSubmit ? c.primaryForeground : c.mutedForeground} />
              <Text style={[s.composeSendText, { color: canSubmit ? c.primaryForeground : c.mutedForeground }]}>Simpan</Text>
            </Pressable>
          </View>

          <Surface style={s.composeCard}>
            <View style={s.composeMetaRow}>
              <View style={[s.composeAvatar, { backgroundColor: c.secondary }]}>
                <Ionicons name="create-outline" size={19} color={c.primary} />
              </View>
              <View style={s.composeMetaCopy}>
                <Text style={[s.composeMetaLabel, { color: c.mutedForeground }]}>Simpan di</Text>
                <Text style={[s.composeMetaValue, { color: c.foreground }]}>{category === 'general' ? 'Catatan biasa' : 'Perlu dibawa'}</Text>
              </View>
            </View>
            <View style={[s.categoryPicker, { borderTopColor: c.border }]}>
              {(['general', 'carry'] as NoteCategory[]).map((item) => {
                const active = category === item;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => onCategoryChange(item)}
                    style={({ pressed }) => [s.categoryChip, { backgroundColor: active ? c.primary : c.secondary, opacity: pressed ? 0.72 : 1 }]}
                  >
                    <Ionicons name={item === 'general' ? 'create-outline' : 'bag-handle-outline'} size={14} color={active ? c.primaryForeground : c.secondaryForeground} />
                    <Text style={[s.categoryChipText, { color: active ? c.primaryForeground : c.secondaryForeground }]}>{item === 'general' ? 'Catatan biasa' : 'Perlu dibawa'}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={[s.composeField, { borderTopColor: c.border }]}>
              <TextInput
                testID="note-subject-input"
                value={subject}
                onChangeText={onSubjectChange}
                placeholder="Judul catatan"
                placeholderTextColor={c.mutedForeground}
                returnKeyType="next"
                style={[s.subjectInput, { color: c.foreground }]}
                accessibilityLabel="Judul catatan"
              />
            </View>
            <View style={[s.composeBodyField, { borderTopColor: c.border }]}>
              <TextInput
                testID="note-body-input"
                value={body}
                onChangeText={onBodyChange}
                placeholder="Tulis isi catatan di sini..."
                placeholderTextColor={c.mutedForeground}
                multiline
                textAlignVertical="top"
                style={[s.bodyInput, { color: c.foreground }]}
                accessibilityLabel="Isi catatan"
              />
            </View>
          </Surface>
          <Text style={[s.composeHint, { color: c.mutedForeground }]}>
            Catatan akan muncul seperti pesan terbaru di daftar {category === 'general' ? 'catatan biasa' : 'perlu dibawa'}.
          </Text>
        </KeyboardAwareScrollViewCompat>
      </View>
    </Modal>
  );
}

function ShoppingContent({
  day,
  items,
  name,
  quantity,
  unit,
  onNameChange,
  onQuantityChange,
  onUnitChange,
  onDayChange,
  onSubmit,
  onToggleItem,
  onDelete,
  onPriceChange,
  onChangeQuantity,
  onClear,
}: {
  day: ShoppingDay;
  items: NoteItem[];
  name: string;
  quantity: string;
  unit: string;
  onNameChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onUnitChange: (value: string) => void;
  onSubmit: () => void;
  onDayChange: (day: ShoppingDay) => void;
  onToggleItem: (day: ShoppingDay, item: NoteItem) => void;
  onDelete: (day: ShoppingDay, id: string) => void;
  onPriceChange: (day: ShoppingDay, id: string, price: number) => void;
  onChangeQuantity: (day: ShoppingDay, id: string, delta: number) => void;
  onClear: () => void;
}) {
  const c = useColors();
  const completed = items.filter((item) => item.done);
  const pending = items.filter((item) => !item.done);
  const progress = items.length ? completed.length / items.length : 0;
  const canSubmit = name.trim().length > 0 && Number.parseFloat(quantity.replace(',', '.')) > 0;

  return (
    <>
      <View style={[s.shoppingDayTabs, { backgroundColor: c.secondary }]}>
        {(['today', 'tomorrow'] as ShoppingDay[]).map((item) => {
          const active = item === day;
          return (
            <Pressable
              key={item}
              testID={`shopping-day-${item}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onDayChange(item)}
              style={({ pressed }) => [s.shoppingDayTab, { backgroundColor: active ? c.card : 'transparent', opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[s.shoppingDayLabel, { color: active ? c.foreground : c.mutedForeground }]}>{item === 'today' ? 'Hari ini' : 'Besok'}</Text>
              <Text style={[s.shoppingDayHint, { color: active ? c.primary : c.mutedForeground }]}>{item === 'today' ? 'Yang dikerjakan' : 'Persiapan awal'}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[s.shoppingSummary, { backgroundColor: c.foreground }]}>
        <View style={s.shoppingSummaryTop}>
          <View style={s.shoppingSummaryIcon}>
            <Ionicons name="basket-outline" size={21} color={c.primaryForeground} />
          </View>
          <View style={s.shoppingSummaryCopy}>
            <Text style={[s.shoppingSummaryKicker, { color: c.primaryForeground + 'B8' }]}>{day === 'today' ? 'Belanja hari ini' : 'Rencana besok'}</Text>
            <Text style={[s.shoppingSummaryTitle, { color: c.card }]}>{day === 'today' ? 'Selesaikan belanja' : 'Daftar belanja'}</Text>
          </View>
          <Text style={[s.shoppingSummaryCount, { color: c.primaryForeground }]}>{completed.length}/{items.length}</Text>
        </View>
        <View style={[s.progressTrack, { backgroundColor: c.primaryForeground + '30' }]}>
          <View style={[s.progressFill, { backgroundColor: c.primaryForeground, width: `${progress * 100}%` }]} />
        </View>
        <Text style={[s.shoppingSummaryHint, { color: c.primaryForeground + 'B8' }]}>
          {items.length ? (completed.length === items.length ? 'Semua kebutuhan sudah dibeli.' : `${pending.length} barang masih perlu dibeli.`) : day === 'today' ? 'Belum ada belanja yang dipindahkan ke hari ini.' : 'Catat kebutuhan warung sebelum berangkat.'}
        </Text>
      </View>

      <View style={[s.shoppingComposer, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={s.shoppingInputRow}>
          <Ionicons name="add-circle-outline" size={19} color={c.primary} />
          <TextInput
            testID="shopping-name-input"
            value={name}
            onChangeText={onNameChange}
            onSubmitEditing={onSubmit}
            placeholder="Nama barang, misalnya minyak goreng"
            placeholderTextColor={c.mutedForeground}
            returnKeyType="done"
            style={[s.shoppingNameInput, { color: c.foreground }]}
            accessibilityLabel="Nama barang belanja"
          />
        </View>
        <View style={s.shoppingFormBottom}>
          <View style={[s.quantityControl, { backgroundColor: c.secondary }]}>
            <TextInput
              testID="shopping-quantity-input"
              value={quantity}
              onChangeText={onQuantityChange}
              keyboardType="decimal-pad"
              selectTextOnFocus
              style={[s.quantityInput, { color: c.foreground }]}
              accessibilityLabel="Jumlah barang"
            />
            <Text style={[s.quantityUnitLabel, { color: c.mutedForeground }]}>{unit}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.unitScroll} contentContainerStyle={s.unitChips}>
            {unitOptions.map((item) => (
              <Pressable
                key={item}
                accessibilityRole="radio"
                accessibilityState={{ selected: unit === item }}
                onPress={() => onUnitChange(item)}
                style={({ pressed }) => [s.unitChip, { backgroundColor: unit === item ? c.primary : c.secondary, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[s.unitChipText, { color: unit === item ? c.primaryForeground : c.mutedForeground }]}>{item}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            testID="add-shopping-item"
            accessibilityRole="button"
            accessibilityLabel="Tambah barang belanja"
            onPress={onSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [s.shoppingAddButton, { backgroundColor: canSubmit ? c.primary : c.muted, opacity: pressed ? 0.72 : 1 }]}
          >
            <Ionicons name="arrow-up" size={18} color={canSubmit ? c.primaryForeground : c.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {pending.length ? (
        <View style={s.shoppingList}>
          {pending.map((item) => (
            <ShoppingRow key={item.id} item={item} day={day} onToggleItem={onToggleItem} onDelete={onDelete} onPriceChange={onPriceChange} onChangeQuantity={onChangeQuantity} />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="checkmark-done-outline"
          title={items.length ? 'Belanja sudah beres' : 'Mulai daftar belanja'}
          body={items.length ? 'Semua barang di daftar ini sudah ditandai dibeli.' : 'Tambahkan barang dan jumlahnya agar persiapan besok lebih teratur.'}
        />
      )}

      {completed.length ? (
        <View style={s.completedSection}>
          <View style={s.completedHeading}>
            <Text style={[s.completedLabel, { color: c.mutedForeground }]}>SUDAH DIBELI · {completed.length}</Text>
            <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel="Hapus barang yang sudah dibeli">
              <Text style={[s.clearButtonText, { color: c.primary }]}>Bersihkan</Text>
            </Pressable>
          </View>
          {completed.map((item) => (
            <ShoppingRow key={item.id} item={item} day={day} onToggleItem={onToggleItem} onDelete={onDelete} onPriceChange={onPriceChange} onChangeQuantity={onChangeQuantity} />
          ))}
        </View>
      ) : null}
    </>
  );
}

function ShoppingRow({
  item,
  day,
  onToggleItem,
  onDelete,
  onPriceChange,
  onChangeQuantity,
}: {
  item: NoteItem;
  day: ShoppingDay;
  onToggleItem: (day: ShoppingDay, item: NoteItem) => void;
  onDelete: (day: ShoppingDay, id: string) => void;
  onPriceChange: (day: ShoppingDay, id: string, price: number) => void;
  onChangeQuantity: (day: ShoppingDay, id: string, delta: number) => void;
}) {
  const c = useColors();
  return (
    <Surface style={s.shoppingRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done }}
        accessibilityLabel={item.done ? `Tandai ${item.text} belum dibeli` : `Tandai ${item.text} sudah dibeli`}
        onPress={() => onToggleItem(day, item)}
        style={({ pressed }) => [s.shoppingCheck, { backgroundColor: item.done ? c.primary : c.secondary, borderColor: item.done ? c.primary : c.border, opacity: pressed ? 0.7 : 1 }]}
      >
        {item.done ? <Ionicons name="checkmark" size={16} color={c.primaryForeground} /> : null}
      </Pressable>
      <View style={s.shoppingRowCopy}>
        <Text style={[s.shoppingRowName, { color: item.done ? c.mutedForeground : c.foreground, textDecorationLine: item.done ? 'line-through' : 'none' }]}>{item.text}</Text>
        <Text style={[s.shoppingRowMeta, { color: c.mutedForeground }]}>
          {item.quantity ?? 1} {item.unit ?? 'pcs'}{day === 'today' && item.price ? ` · ${formatRp(item.price)}` : ''}
        </Text>
        {day === 'today' ? (
          <View style={s.itemPriceRow}>
            <Text style={[s.itemPriceLabel, { color: c.mutedForeground }]}>Total harga</Text>
            <View style={[s.itemPriceInputWrap, { backgroundColor: c.secondary }]}>
              <Text style={[s.itemPricePrefix, { color: c.mutedForeground }]}>Rp</Text>
              <TextInput
                value={item.price ? String(item.price) : ''}
                onChangeText={(value) => onPriceChange(day, item.id, Number(value.replace(/[^0-9]/g, '')))}
                editable={!item.done && !item.expenseRecorded}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={c.mutedForeground}
                style={[s.itemPriceInput, { color: c.foreground }]}
                accessibilityLabel={`Total harga ${item.text}`}
              />
            </View>
            {item.expenseRecorded ? <Ionicons name="checkmark-circle" size={15} color={c.primary} /> : null}
          </View>
        ) : null}
      </View>
      {!item.done ? (
        <View style={[s.stepper, { backgroundColor: c.secondary }]}>
          <Pressable onPress={() => onChangeQuantity(day, item.id, -1)} hitSlop={6} accessibilityLabel={`Kurangi jumlah ${item.text}`}>
            <Ionicons name="remove" size={15} color={c.mutedForeground} />
          </Pressable>
          <Text style={[s.stepperValue, { color: c.foreground }]}>{item.quantity ?? 1}</Text>
          <Pressable onPress={() => onChangeQuantity(day, item.id, 1)} hitSlop={6} accessibilityLabel={`Tambah jumlah ${item.text}`}>
            <Ionicons name="add" size={15} color={c.primary} />
          </Pressable>
        </View>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`Hapus ${item.text}`} onPress={() => onDelete(day, item.id)} hitSlop={8} style={s.deleteButton}>
        <Ionicons name="trash-outline" size={17} color={c.mutedForeground} />
      </Pressable>
    </Surface>
  );
}

function NoteRow({
  item,
  category,
  onToggle,
  onDelete,
  onOpen,
}: {
  item: Pick<NoteItem, 'id' | 'text' | 'done' | 'createdAt'>;
  category: NoteCategory;
  onToggle: (category: NoteCategory, id: string) => void;
  onDelete: (category: NoteCategory, id: string) => void;
  onOpen: () => void;
}) {
  const c = useColors();
  const [subject, ...bodyLines] = item.text.split('\n');
  const preview = bodyLines.join(' ').trim() || 'Tidak ada isi tambahan';
  const createdAt = new Date(item.createdAt);
  const timeLabel = Number.isNaN(createdAt.getTime())
    ? ''
    : createdAt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  return (
    <Surface style={[s.noteRow, item.done ? s.noteRowDone : null]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done }}
        accessibilityLabel={item.done ? `Tandai ${item.text} belum selesai` : `Tandai ${item.text} selesai`}
        onPress={() => onToggle(category, item.id)}
        style={({ pressed }) => [s.checkButton, { backgroundColor: item.done ? c.primary : c.secondary, borderColor: item.done ? c.primary : c.border, opacity: pressed ? 0.72 : 1 }]}
      >
        {item.done ? <Ionicons name="checkmark" size={16} color={c.primaryForeground} /> : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Buka catatan ${subject || 'tanpa judul'}`}
        onPress={onOpen}
        style={s.noteCopy}
      >
        <Text numberOfLines={1} style={[s.noteSubject, { color: item.done ? c.mutedForeground : c.foreground, textDecorationLine: item.done ? 'line-through' : 'none' }]}>{subject || 'Tanpa judul'}</Text>
        <Text numberOfLines={1} style={[s.notePreview, { color: c.mutedForeground }]}>{preview}</Text>
      </Pressable>
      <Text style={[s.noteDate, { color: item.done ? c.mutedForeground : c.primary }]}>{timeLabel}</Text>
      <Ionicons name="chevron-forward" size={15} color={c.mutedForeground} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Hapus ${item.text}`}
        onPress={() => onDelete(category, item.id)}
        hitSlop={8}
        style={({ pressed }) => [s.deleteButton, { opacity: pressed ? 0.55 : 1 }]}
      >
        <Ionicons name="trash-outline" size={17} color={c.mutedForeground} />
      </Pressable>
    </Surface>
  );
}

function NoteDetailModal({
  note,
  category,
  onClose,
}: {
  note: NoteItem | null;
  category: NoteCategory;
  onClose: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  if (!note) return null;

  const [subject, ...bodyLines] = note.text.split('\n');
  const body = bodyLines.join('\n').trim();
  const createdAt = new Date(note.createdAt);
  const dateLabel = Number.isNaN(createdAt.getTime())
    ? ''
    : createdAt.toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const categoryLabel = category === 'carry' ? 'Perlu dibawa' : 'Catatan biasa';

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[s.composeRoot, { backgroundColor: c.background }]}>
        <ScrollView
          contentContainerStyle={[s.detailContent, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.composeHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel="Tutup detail catatan" onPress={onClose} hitSlop={8} style={s.composeIconButton}>
              <Ionicons name="arrow-back" size={24} color={c.foreground} />
            </Pressable>
            <View style={s.composeHeaderCopy}>
              <Text style={[s.composeKicker, { color: c.primary }]}>DETAIL CATATAN</Text>
              <Text style={[s.composeTitle, { color: c.foreground }]}>Catatan</Text>
            </View>
            <View style={[s.detailStatus, { backgroundColor: note.done ? c.secondary : c.primary }]}>
              <Ionicons name={note.done ? 'checkmark' : 'mail-open-outline'} size={15} color={note.done ? c.secondaryForeground : c.primaryForeground} />
              <Text style={[s.detailStatusText, { color: note.done ? c.secondaryForeground : c.primaryForeground }]}>{note.done ? 'Selesai' : 'Aktif'}</Text>
            </View>
          </View>

          <Surface style={s.detailCard}>
            <View style={s.detailMeta}>
              <View style={[s.composeAvatar, { backgroundColor: c.secondary }]}>
                <Ionicons name={category === 'carry' ? 'bag-handle-outline' : 'create-outline'} size={19} color={c.primary} />
              </View>
              <View style={s.composeMetaCopy}>
                <Text style={[s.composeMetaValue, { color: c.foreground }]}>{categoryLabel}</Text>
                <Text style={[s.composeMetaLabel, { color: c.mutedForeground }]}>{dateLabel}</Text>
              </View>
            </View>
            <View style={[s.detailDivider, { backgroundColor: c.border }]} />
            <Text style={[s.detailSubject, { color: c.foreground }]}>{subject || 'Tanpa judul'}</Text>
            <Text style={[s.detailBody, { color: body ? c.foreground : c.mutedForeground }]}>
              {body || 'Catatan ini tidak memiliki isi tambahan.'}
            </Text>
          </Surface>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  categoryTabs: { flexDirection: 'row', gap: 7, marginBottom: 18 },
  categoryTab: { flex: 1, minHeight: 54, borderWidth: 1, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, gap: 3 },
  categoryTabText: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 11 },
  sectionCopy: { flex: 1 },
  sectionTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.2 },
  sectionHelper: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  clearButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 },
  clearButtonText: { fontSize: 10, fontWeight: '800' },
  shoppingDayTabs: { flexDirection: 'row', borderRadius: 15, padding: 4, marginBottom: 10 },
  shoppingDayTab: { flex: 1, borderRadius: 11, minHeight: 47, alignItems: 'center', justifyContent: 'center' },
  shoppingDayLabel: { fontSize: 12, fontWeight: '800' },
  shoppingDayHint: { fontSize: 9, fontWeight: '700', marginTop: 2 },
  shoppingSummary: { borderRadius: 22, padding: 16, marginBottom: 12 },
  shoppingSummaryTop: { flexDirection: 'row', alignItems: 'center' },
  shoppingSummaryIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  shoppingSummaryCopy: { flex: 1, marginLeft: 10 },
  shoppingSummaryKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  shoppingSummaryTitle: { fontSize: 19, fontWeight: '800', marginTop: 2 },
  shoppingSummaryCount: { fontSize: 17, fontWeight: '800' },
  progressTrack: { height: 7, borderRadius: 6, overflow: 'hidden', marginTop: 15 },
  progressFill: { height: '100%', borderRadius: 6 },
  shoppingSummaryHint: { fontSize: 11, marginTop: 8 },
  shoppingComposer: { borderWidth: 1, borderRadius: 19, padding: 12, marginBottom: 13 },
  shoppingInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shoppingNameInput: { flex: 1, minHeight: 34, fontSize: 13, fontWeight: '600' },
  shoppingFormBottom: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  quantityControl: { height: 37, minWidth: 62, borderRadius: 11, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9 },
  quantityInput: { minWidth: 25, padding: 0, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  quantityUnitLabel: { fontSize: 10, fontWeight: '700', marginLeft: 3 },
  unitScroll: { flex: 1, flexShrink: 1 },
  unitChips: { flexDirection: 'row', gap: 4 },
  unitChip: { height: 31, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  unitChipText: { fontSize: 9, fontWeight: '800' },
  shoppingAddButton: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  shoppingList: { gap: 9 },
  shoppingRow: { minHeight: 70, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  shoppingCheck: { width: 26, height: 26, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  shoppingRowCopy: { flex: 1 },
  shoppingRowName: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  shoppingRowMeta: { fontSize: 11, marginTop: 3, fontWeight: '600' },
  itemPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  itemPriceLabel: { fontSize: 10, fontWeight: '700' },
  itemPriceInputWrap: { height: 28, minWidth: 96, borderRadius: 8, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center' },
  itemPricePrefix: { fontSize: 10, fontWeight: '800', marginRight: 4 },
  itemPriceInput: { flex: 1, minWidth: 56, padding: 0, fontSize: 11, fontWeight: '800' },
  stepper: { height: 30, borderRadius: 9, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepperValue: { minWidth: 17, textAlign: 'center', fontSize: 11, fontWeight: '800' },
  noteList: { gap: 9 },
  noteRow: { minHeight: 72, paddingVertical: 11, paddingLeft: 11, paddingRight: 7, flexDirection: 'row', alignItems: 'center', gap: 9 },
  noteRowDone: { opacity: 0.8 },
  checkButton: { width: 27, height: 27, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  noteCopy: { flex: 1, minWidth: 0 },
  noteSubject: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  notePreview: { fontSize: 11, lineHeight: 17, marginTop: 2 },
  noteDate: { alignSelf: 'flex-start', fontSize: 10, fontWeight: '800', marginTop: 2 },
  deleteButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  completedSection: { marginTop: 24, gap: 9 },
  completedHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  completedLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 1 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  fab: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 6px 14px rgba(10, 10, 10, 0.18)', elevation: 5 },
  composeRoot: { flex: 1 },
  composeContent: { paddingHorizontal: 16 },
  composeHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 16 },
  composeIconButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  composeHeaderCopy: { flex: 1 },
  composeKicker: { fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  composeTitle: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  composeSendButton: { minHeight: 39, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  composeSendText: { fontSize: 11, fontWeight: '800' },
  composeCard: { padding: 0, overflow: 'hidden' },
  composeMetaRow: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  composeAvatar: { width: 39, height: 39, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  composeMetaCopy: { marginLeft: 10 },
  composeMetaLabel: { fontSize: 10, fontWeight: '700' },
  composeMetaValue: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  categoryPicker: { borderTopWidth: 1, padding: 11, flexDirection: 'row', gap: 7 },
  categoryChip: { minHeight: 32, borderRadius: 10, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  categoryChipText: { fontSize: 10, fontWeight: '800' },
  composeField: { borderTopWidth: 1, paddingHorizontal: 15 },
  subjectInput: { minHeight: 51, fontSize: 15, fontWeight: '800' },
  composeBodyField: { borderTopWidth: 1, paddingHorizontal: 15, paddingTop: 13 },
  bodyInput: { minHeight: 220, fontSize: 14, lineHeight: 21 },
  composeHint: { fontSize: 11, lineHeight: 17, marginTop: 12, paddingHorizontal: 4 },
  detailContent: { paddingHorizontal: 16 },
  detailStatus: { minHeight: 32, borderRadius: 10, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailStatusText: { fontSize: 10, fontWeight: '800' },
  detailCard: { padding: 0, overflow: 'hidden' },
  detailMeta: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  detailDivider: { height: 1, marginHorizontal: 15 },
  detailSubject: { fontSize: 21, lineHeight: 27, fontWeight: '800', paddingHorizontal: 15, paddingTop: 17 },
  detailBody: { fontSize: 14, lineHeight: 22, paddingHorizontal: 15, paddingTop: 13, paddingBottom: 22 },
});