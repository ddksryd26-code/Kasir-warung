import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import {
  completeFirstLaunchTutorial,
  hasCompletedFirstLaunchTutorial,
  isFirstLaunchTutorialPreviewEnabled,
} from '@/utils/firstLaunchTutorial';

type TutorialStep = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  targetLabel?: string;
  targetRoute?: Href;
};

const steps: TutorialStep[] = [
  {
    icon: 'storefront-outline',
    eyebrow: 'SELAMAT DATANG',
    title: 'Kasir Miso siap membantu warungmu',
    body: 'Kelola pesanan, dapur, catatan, dan uang masuk-keluar dari satu aplikasi.',
    points: ['Data tersimpan di perangkat', 'Bisa dipakai tanpa internet', 'Tampilan dapat disesuaikan'],
  },
  {
    icon: 'receipt-outline',
    eyebrow: 'LANGKAH 1',
    title: 'Mulai dari tab Kasir',
    body: 'Tekan tombol Kasir di bar bawah untuk mencatat pesanan pelanggan dan transaksi.',
    points: ['Tekan menu untuk menambah pesanan', 'Atur jumlah dan catatan pesanan', 'Lihat ringkasan sebelum menyimpan'],
    targetLabel: 'Kasir',
    targetRoute: '/',
  },
  {
    icon: 'restaurant-outline',
    eyebrow: 'LANGKAH 2',
    title: 'Pantau pesanan di Dapur',
    body: 'Tekan tombol Dapur di bar bawah untuk melihat antrian yang perlu dimasak.',
    points: ['Pesanan baru masuk ke antrian', 'Tandai pesanan yang sedang dibuat', 'Selesaikan pesanan setelah siap'],
    targetLabel: 'Dapur',
    targetRoute: '/kitchen',
  },
  {
    icon: 'create-outline',
    eyebrow: 'LANGKAH 3',
    title: 'Simpan pengingat di Catatan',
    body: 'Tekan tombol Catatan untuk menyimpan daftar belanja dan hal penting untuk warung.',
    points: ['Buat catatan biasa', 'Simpan daftar yang perlu dibawa', 'Edit atau hapus catatan kapan saja'],
    targetLabel: 'Catatan',
    targetRoute: '/notes',
  },
  {
    icon: 'shield-checkmark-outline',
    eyebrow: 'LANGKAH 4',
    title: 'Jaga data tetap aman',
    body: 'Tekan tombol Lainnya untuk membuka Backup Offline, QRIS, dan Arus Kas.',
    points: ['Backup bisa disimpan sebagai file JSON', 'Restore memeriksa data sebelum diterapkan', 'Backup online mendeteksi konflik perangkat'],
    targetLabel: 'Lainnya',
    targetRoute: '/other',
  },
];

export function FirstLaunchTutorial() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    let active = true;
    hasCompletedFirstLaunchTutorial()
      .then((completed) => {
        if (!active) return;
        setVisible(isFirstLaunchTutorialPreviewEnabled() || !completed);
        setChecked(true);
      })
      .catch(() => {
        if (!active) return;
        setVisible(true);
        setChecked(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const finish = () => {
    setVisible(false);
    void completeFirstLaunchTutorial();
  };

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  const openTarget = () => {
    if (!currentStep.targetRoute) {
      setStepIndex((current) => current + 1);
      return;
    }

    finish();
    router.replace(currentStep.targetRoute);
  };

  if (!checked || !visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={finish}
    >
      <View style={[styles.backdrop, { backgroundColor: `${c.foreground}D9` }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.card,
              borderColor: c.border,
              paddingTop: Math.max(insets.top, 18) + 12,
              paddingBottom: Math.max(insets.bottom, 16) + 16,
            },
          ]}
        >
          <View style={styles.topRow}>
            <View style={[styles.brandMark, { backgroundColor: c.secondary }]}>
              <Ionicons name="sparkles-outline" size={19} color={c.primary} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lewati tutorial"
              onPress={finish}
              hitSlop={10}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={[styles.skip, { color: c.mutedForeground }]}>Lewati</Text>
            </Pressable>
          </View>

          <View style={styles.progressRow} accessibilityLabel={`Langkah ${stepIndex + 1} dari ${steps.length}`}>
            {steps.map((item, index) => (
              <View
                key={item.title}
                style={[
                  styles.progressItem,
                  { backgroundColor: index <= stepIndex ? c.primary : c.muted },
                ]}
              />
            ))}
          </View>

          <View style={[styles.iconWrap, { backgroundColor: c.primary }]}>
            <Ionicons name={currentStep.icon} size={42} color={c.primaryForeground} />
          </View>

          <Text style={[styles.eyebrow, { color: c.primary }]}>{currentStep.eyebrow}</Text>
          <Text style={[styles.title, { color: c.foreground }]}>{currentStep.title}</Text>
          <Text style={[styles.body, { color: c.mutedForeground }]}>{currentStep.body}</Text>

          <View style={styles.points}>
            {currentStep.points.map((point) => (
              <View key={point} style={styles.point}>
                <Ionicons name="checkmark-circle" size={19} color={c.primary} />
                <Text style={[styles.pointText, { color: c.foreground }]}>{point}</Text>
              </View>
            ))}
          </View>

          {currentStep.targetLabel ? (
            <View style={[styles.targetCallout, { backgroundColor: c.secondary, borderColor: c.border }]}>
              <View style={[styles.targetIcon, { backgroundColor: c.primary }]}>
                <Ionicons name="hand-left-outline" size={17} color={c.primaryForeground} />
              </View>
              <View style={styles.targetCopy}>
                <Text style={[styles.targetTitle, { color: c.foreground }]}>
                  Arahkan ke tombol {currentStep.targetLabel}
                </Text>
                <Text style={[styles.targetBody, { color: c.mutedForeground }]}>
                  Tombolnya ada di bar bawah aplikasi.
                </Text>
              </View>
              <Ionicons name="arrow-down" size={21} color={c.primary} />
            </View>
          ) : null}

          <View style={styles.actions}>
            {currentStep.targetLabel && isLastStep ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Buka tab ${currentStep.targetLabel}`}
                onPress={openTarget}
                style={({ pressed }) => [
                  styles.nextButton,
                  { backgroundColor: c.primary, opacity: pressed ? 0.78 : 1 },
                ]}
              >
                <Text style={[styles.nextButtonText, { color: c.primaryForeground }]}>
                  Buka tab {currentStep.targetLabel}
                </Text>
                <Ionicons name="arrow-forward" size={17} color={c.primaryForeground} />
              </Pressable>
            ) : !isLastStep ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Langkah berikutnya"
                onPress={() => setStepIndex((current) => current + 1)}
                style={({ pressed }) => [
                  styles.nextButton,
                  { backgroundColor: c.primary, opacity: pressed ? 0.78 : 1 },
                ]}
              >
                <Text style={[styles.nextButtonText, { color: c.primaryForeground }]}>Berikutnya</Text>
                <Ionicons name="arrow-forward" size={17} color={c.primaryForeground} />
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mulai menggunakan Kasir Miso"
                onPress={finish}
                style={({ pressed }) => [
                  styles.nextButton,
                  { backgroundColor: c.primary, opacity: pressed ? 0.78 : 1 },
                ]}
              >
                <Text style={[styles.nextButtonText, { color: c.primaryForeground }]}>Mulai pakai Kasir Miso</Text>
                <Ionicons name="checkmark" size={18} color={c.primaryForeground} />
              </Pressable>
            )}
            {currentStep.targetLabel && !isLastStep ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Langsung buka tab ${currentStep.targetLabel}`}
                onPress={openTarget}
                style={({ pressed }) => [
                  styles.targetButton,
                  { borderColor: c.border, backgroundColor: c.secondary, opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <Ionicons name="open-outline" size={16} color={c.primary} />
                <Text style={[styles.targetButtonText, { color: c.secondaryForeground }]}>
                  Langsung buka tab {currentStep.targetLabel}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 22,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skip: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 23,
  },
  progressItem: {
    height: 4,
    flex: 1,
    borderRadius: 10,
  },
  iconWrap: {
    width: 86,
    height: 86,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 30,
    marginBottom: 24,
  },
  eyebrow: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  title: {
    textAlign: 'center',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 7,
  },
  body: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 11,
  },
  points: {
    gap: 11,
    marginTop: 24,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  pointText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  targetCallout: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 23,
  },
  targetIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetCopy: {
    flex: 1,
  },
  targetTitle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  targetBody: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  actions: {
    marginTop: 28,
  },
  nextButton: {
    minHeight: 50,
    borderRadius: 15,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  nextButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  targetButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    marginTop: 9,
  },
  targetButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
});