import React, { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import { useAuthRequest } from 'expo-auth-session/providers/google';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  getDriveImage,
  getGetDriveConnectionQueryKey,
  getListDriveBackupsQueryKey,
  restoreDriveBackup,
  uploadDriveImage,
  useConnectDrive,
  useDisconnectDrive,
  useGetDriveConnection,
  useListDriveBackups,
  useSaveDriveBackup,
  type SaveDriveBackupBody,
} from '@workspace/api-client-react';
import { PrimaryButton, Surface } from '@/components/WarungUI';
import { useColors } from '@/hooks/useColors';
import { useWarung } from '@/context/WarungContext';
import { mimeTypeFromUri, persistImageBase64, readImageAsBase64 } from '@/utils/persistentImage';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type GoogleDriveBackupCardProps = {
  isAuthLoaded: boolean;
  isSignedIn: boolean;
  onRequestSignIn: () => void;
};

const DRIVE_IMAGE_REFERENCE_PREFIX = 'drive-image:';
const PENDING_DRIVE_IMAGE_PREFIX = 'pending-drive-image:';

type PendingDriveImage = {
  placeholder: string;
  fileName: string;
  uri: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
};

function parseDriveImageReference(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith(DRIVE_IMAGE_REFERENCE_PREFIX)) return null;
  const [, fileId, mimeType] = value.split(':');
  if (!fileId || !mimeType) return null;
  return { fileId, mimeType };
}

async function prepareDriveBackupState(warung: ReturnType<typeof useWarung>) {
  const pending: PendingDriveImage[] = [];
  const pendingByUri = new Map<string, PendingDriveImage>();
  const imagePlaceholder = async (uri: string | undefined, fileName: string) => {
    if (!uri) return uri;
    if (parseDriveImageReference(uri)) return uri;
    const existing = pendingByUri.get(uri);
    if (existing) return existing.placeholder;
    const mimeType = uri.startsWith('data:')
      ? uri.slice(5, uri.indexOf(',')).split(';', 1)[0] || 'image/jpeg'
      : mimeTypeFromUri(uri);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      throw new Error('Format gambar backup harus JPG, PNG, atau WebP.');
    }
    const item: PendingDriveImage = {
      placeholder: `${PENDING_DRIVE_IMAGE_PREFIX}${pending.length}`,
      fileName,
      uri,
      mimeType: mimeType as PendingDriveImage['mimeType'],
    };
    pending.push(item);
    pendingByUri.set(uri, item);
    return item.placeholder;
  };

  const menus = [];
  for (const [index, item] of warung.menus.entries()) {
    menus.push({
      ...item,
      imageUri: await imagePlaceholder(item.imageUri, `menu-${index}`),
    });
  }
  const consignments = [];
  for (const [index, item] of warung.consignments.entries()) {
    consignments.push({
      ...item,
      imageUri: await imagePlaceholder(item.imageUri, `titipan-${index}`),
    });
  }

  return {
    state: {
      menus,
      activeOrders: warung.activeOrders,
      kitchenOrders: warung.kitchenOrders,
      inventory: warung.inventory,
      stockMovements: warung.stockMovements,
      consignments,
      expenses: warung.expenses,
      sales: warung.sales,
      auditTrail: warung.auditTrail,
      cashClosures: warung.cashClosures,
      savingsRules: warung.savingsRules,
      savingsEntries: warung.savingsEntries,
      qrisImageUri: await imagePlaceholder(warung.qrisImageUri, 'qris'),
    } as unknown as SaveDriveBackupBody['state'],
    pending,
  };
}

function replaceDriveImagePlaceholders(
  state: SaveDriveBackupBody['state'],
  replacements: Map<string, string>,
) {
  return {
    ...state,
    menus: state.menus.map((item) => ({
      ...item,
      imageUri: typeof item.imageUri === 'string'
        ? replacements.get(item.imageUri) ?? item.imageUri
        : item.imageUri,
    })),
    consignments: state.consignments.map((item) => ({
      ...item,
      imageUri: typeof item.imageUri === 'string'
        ? replacements.get(item.imageUri) ?? item.imageUri
        : item.imageUri,
    })),
    qrisImageUri: typeof state.qrisImageUri === 'string'
      ? replacements.get(state.qrisImageUri) ?? state.qrisImageUri
      : state.qrisImageUri,
  };
}

function collectDriveImageReferences(state: SaveDriveBackupBody['state']) {
  const references = new Map<string, { fileId: string; mimeType: string }>();
  const collect = (value: unknown) => {
    const reference = parseDriveImageReference(value);
    if (reference) references.set(value as string, reference);
  };
  state.menus.forEach((item) => collect(item.imageUri));
  state.consignments.forEach((item) => collect(item.imageUri));
  collect(state.qrisImageUri);
  return references;
}

async function restoreDriveImages(
  state: SaveDriveBackupBody['state'],
  onProgress: (message: string) => void,
) {
  const references = collectDriveImageReferences(state);
  const replacements = new Map<string, string>();
  let completed = 0;
  for (const [reference, image] of references) {
    onProgress(`Mengunduh gambar ${completed + 1} dari ${references.size}...`);
    const downloaded = await getDriveImage(image.fileId);
    replacements.set(
      reference,
      await persistImageBase64(downloaded.base64, downloaded.mimeType || image.mimeType),
    );
    completed += 1;
  }
  return replaceDriveImagePlaceholders(state, replacements);
}

export function GoogleDriveBackupCard({
  isAuthLoaded,
  isSignedIn,
  onRequestSignIn,
}: GoogleDriveBackupCardProps) {
  const c = useColors();
  const warung = useWarung();
  const queryClient = useQueryClient();
  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? '';
  const driveRedirectUri = AuthSession.makeRedirectUri({
    scheme: 'kasir-miso',
    path: 'drive-callback',
  });
  const [driveRequest, driveResponse, promptDriveAsync] = useAuthRequest(
    {
      clientId: googleClientId,
      scopes: ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'],
      responseType: AuthSession.ResponseType.Code,
      selectAccount: true,
      shouldAutoExchangeCode: false,
      extraParams: { access_type: 'offline', prompt: 'consent' },
    },
    { scheme: 'kasir-miso', path: 'drive-callback' },
  );
  const [driveNotice, setDriveNotice] = useState('');
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveProgress, setDriveProgress] = useState('');
  const handledDriveCode = useRef<string | null>(null);
  const autoConnectAttempted = useRef(false);
  const driveConnectionQuery = useGetDriveConnection({
    query: {
      queryKey: getGetDriveConnectionQueryKey(),
      enabled: Boolean(isAuthLoaded && isSignedIn),
    },
  });
  const driveBackupsQuery = useListDriveBackups({
    query: {
      queryKey: getListDriveBackupsQueryKey(),
      enabled: Boolean(isAuthLoaded && isSignedIn && driveConnectionQuery.data?.connected),
    },
  });
  const connectDriveMutation = useConnectDrive({
    mutation: {
      onSuccess: () => {
        setDriveNotice('');
        void queryClient.invalidateQueries({ queryKey: getGetDriveConnectionQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getListDriveBackupsQueryKey() });
        Alert.alert('Google Drive terhubung', 'Backup online siap digunakan.');
      },
      onError: () => {
        setDriveNotice('Google Drive belum berhasil dihubungkan. Coba lagi dan pilih akun Google yang benar.');
      },
    },
  });
  const disconnectDriveMutation = useDisconnectDrive({
    mutation: {
      onSuccess: () => {
        setDriveNotice('');
        void queryClient.invalidateQueries({ queryKey: getGetDriveConnectionQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getListDriveBackupsQueryKey() });
        Alert.alert('Google Drive diputuskan', 'Aplikasi tidak lagi menyimpan akses ke Google Drive akun ini.');
      },
      onError: () => {
        setDriveNotice('Google Drive belum berhasil diputuskan. Coba lagi.');
      },
    },
  });
  const backupMutation = useSaveDriveBackup({
    mutation: {
      onSuccess: () => {
        Alert.alert('Backup berhasil', 'Salinan data Kasir Miso sudah tersimpan di Google Drive.');
        void queryClient.invalidateQueries({ queryKey: getListDriveBackupsQueryKey() });
      },
      onError: () => {
        Alert.alert('Backup gagal', 'Data belum tersimpan. Pastikan Google Drive akun ini sudah terhubung lalu coba lagi.');
      },
    },
  });

  const handleDriveConnect = async () => {
    if (connectDriveMutation.isPending) return;
    if (!googleClientId || !driveRequest) {
      setDriveNotice('Konfigurasi OAuth Google belum tersedia di aplikasi ini.');
      return;
    }
    setDriveNotice('');
    await promptDriveAsync();
  };

  useEffect(() => {
    if (
      !isAuthLoaded
      || !isSignedIn
      || !driveConnectionQuery.data
      || driveConnectionQuery.data.connected
      || driveConnectionQuery.isPending
      || autoConnectAttempted.current
      || !googleClientId
      || !driveRequest
    ) {
      return;
    }
    autoConnectAttempted.current = true;
    void promptDriveAsync();
  }, [
    driveConnectionQuery.data,
    driveConnectionQuery.isPending,
    driveRequest,
    googleClientId,
    isAuthLoaded,
    isSignedIn,
    promptDriveAsync,
  ]);

  useEffect(() => {
    if (!driveResponse) return;
    if (driveResponse.type === 'error') {
      setDriveNotice('Login Google Drive dibatalkan atau gagal. Gunakan tombol Hubungkan ulang untuk mencoba lagi.');
      return;
    }
    if (driveResponse.type !== 'success') return;
    const code = driveResponse.params.code;
    if (!code || !driveRequest?.codeVerifier || handledDriveCode.current === code) return;
    handledDriveCode.current = code;
    connectDriveMutation.mutate({
      data: {
        code,
        redirectUri: driveRedirectUri,
        codeVerifier: driveRequest.codeVerifier,
      },
    });
  }, [connectDriveMutation, driveRedirectUri, driveRequest, driveResponse]);

  const handleDriveBackup = async () => {
    if (!warung.hydrated || driveBusy || backupMutation.isPending || !driveConnectionQuery.data?.connected) return;
    setDriveBusy(true);
    setDriveNotice('');
    try {
      setDriveProgress('Menyiapkan gambar backup...');
      const prepared = await prepareDriveBackupState(warung);
      const replacements = new Map<string, string>();
      for (const [index, image] of prepared.pending.entries()) {
        setDriveProgress(`Mengunggah gambar ${index + 1} dari ${prepared.pending.length}...`);
        const imageData = await readImageAsBase64(image.uri);
        const uploaded = await uploadDriveImage({
          fileName: image.fileName,
          mimeType: imageData.mimeType as PendingDriveImage['mimeType'],
          base64: imageData.base64,
        });
        replacements.set(
          image.placeholder,
          `${DRIVE_IMAGE_REFERENCE_PREFIX}${uploaded.id}:${uploaded.mimeType || image.mimeType}`,
        );
      }
      setDriveProgress('Menyimpan backup online...');
      await backupMutation.mutateAsync({
        data: { state: replaceDriveImagePlaceholders(prepared.state, replacements) },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backup Google Drive gagal.';
      setDriveNotice(message);
      Alert.alert('Backup gagal', 'Gambar atau data belum tersimpan lengkap. Data lokal tetap aman, silakan coba lagi.');
    } finally {
      setDriveBusy(false);
      setDriveProgress('');
    }
  };

  const restoreLatestDriveBackup = async (fileId: string) => {
    if (driveBusy) return;
    setDriveBusy(true);
    setDriveNotice('');
    try {
      setDriveProgress('Membaca backup online...');
      const manifest = await restoreDriveBackup({ fileId });
      setDriveProgress('Menyiapkan gambar restore...');
      const restoredState = await restoreDriveImages(manifest.data, setDriveProgress);
      await warung.restoreState(restoredState);
      Alert.alert('Restore berhasil', 'Data dan gambar dari Google Drive sudah dipulihkan ke perangkat ini.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Restore Google Drive gagal.';
      setDriveNotice(message);
      Alert.alert('Restore gagal', 'Data lama tetap dipertahankan. Silakan coba lagi dengan koneksi yang stabil.');
    } finally {
      setDriveBusy(false);
      setDriveProgress('');
    }
  };

  const handleDriveRestore = () => {
    const latestBackup = driveBackupsQuery.data?.backups?.[0];
    if (!latestBackup || driveBusy) {
      setDriveNotice('Belum ada backup online Google Drive yang tersedia.');
      return;
    }
    Alert.alert(
      'Pulihkan backup online terbaru?',
      `Data aplikasi akan diganti dengan backup ${latestBackup.name}.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Pulihkan',
          style: 'destructive',
          onPress: () => void restoreLatestDriveBackup(latestBackup.id),
        },
      ],
    );
  };

  const isConnected = driveConnectionQuery.data?.connected === true;
  const hasBackups = Boolean(driveBackupsQuery.data?.backups?.length);

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionKicker, { color: c.primary }]}>BACKUP ONLINE</Text>
      <Text style={[styles.sectionTitle, { color: c.foreground }]}>Google Drive</Text>
      <Text style={[styles.sectionBody, { color: c.mutedForeground }]}>
        Data bisa dicadangkan dan dipulihkan dari perangkat lain menggunakan akun Google yang sama.
      </Text>
      <Surface style={styles.card}>
        <View style={[styles.icon, { backgroundColor: c.secondary }]}>
          <Ionicons name="cloud-outline" size={23} color={c.primary} />
        </View>
        <Text style={[styles.status, { color: c.foreground }]}>
          {!isSignedIn
            ? 'Login diperlukan'
            : isConnected
              ? `Terhubung${driveConnectionQuery.data?.email ? `: ${driveConnectionQuery.data.email}` : ''}`
              : 'Menghubungkan Google Drive'}
        </Text>
        <Text style={[styles.detail, { color: c.mutedForeground }]}>
          {!isSignedIn
            ? 'Masuk ke akun Google untuk mengaktifkan backup online.'
            : isConnected
              ? 'Backup online siap digunakan dari tab Lainnya.'
              : 'Google akan meminta persetujuan akses Drive satu kali.'}
        </Text>

        {!isSignedIn ? (
          <PrimaryButton testID="online-backup-sign-in" icon="logo-google" onPress={onRequestSignIn}>
            Masuk dengan Google
          </PrimaryButton>
        ) : isConnected ? (
          <Pressable
            testID="google-drive-disconnect"
            accessibilityRole="button"
            accessibilityLabel="Putuskan Google Drive"
            disabled={disconnectDriveMutation.isPending}
            onPress={() => disconnectDriveMutation.mutate()}
            style={({ pressed }) => [styles.disconnect, { borderColor: c.border, opacity: pressed || disconnectDriveMutation.isPending ? 0.6 : 1 }]}
          >
            <Ionicons name="unlink-outline" size={16} color={c.destructive} />
            <Text style={[styles.disconnectText, { color: c.destructive }]}>
              {disconnectDriveMutation.isPending ? 'Memutuskan...' : 'Putuskan'}
            </Text>
          </Pressable>
        ) : (
          <PrimaryButton
            testID="google-drive-connect"
            icon="link-outline"
            disabled={!driveRequest || connectDriveMutation.isPending}
            onPress={() => void handleDriveConnect()}
          >
            {connectDriveMutation.isPending ? 'Menghubungkan...' : 'Hubungkan ulang'}
          </PrimaryButton>
        )}

        {driveNotice ? <Text style={[styles.notice, { color: c.destructive }]}>{driveNotice}</Text> : null}
        {driveProgress ? <Text style={[styles.notice, { color: c.primary }]}>{driveProgress}</Text> : null}

        <PrimaryButton
          testID="google-drive-backup"
          icon="cloud-upload-outline"
          disabled={!isConnected || !warung.hydrated || driveBusy || backupMutation.isPending}
          onPress={() => void handleDriveBackup()}
        >
          {driveBusy ? 'Memproses...' : 'Backup online sekarang'}
        </PrimaryButton>
        <PrimaryButton
          testID="google-drive-restore"
          icon="cloud-download-outline"
          disabled={!isConnected || !warung.hydrated || driveBusy || !hasBackups}
          onPress={handleDriveRestore}
        >
          {driveBusy ? 'Memproses...' : 'Restore online terbaru'}
        </PrimaryButton>
        {backupMutation.data?.webViewLink ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Buka backup terbaru di Google Drive"
            onPress={() => void Linking.openURL(backupMutation.data?.webViewLink ?? '')}
            style={({ pressed }) => [styles.driveLink, { opacity: pressed ? 0.65 : 1 }]}
          >
            <Ionicons name="open-outline" size={16} color={c.primary} />
            <Text style={[styles.driveLinkText, { color: c.primary }]}>Buka di Google Drive</Text>
          </Pressable>
        ) : null}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 16 },
  sectionKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: 2 },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  sectionBody: { fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: 12 },
  card: { gap: 10 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  status: { fontSize: 14, fontWeight: '800' },
  detail: { fontSize: 11, lineHeight: 16 },
  disconnect: { minHeight: 42, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  disconnectText: { fontSize: 12, fontWeight: '800' },
  notice: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
  driveLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  driveLinkText: { fontSize: 12, fontWeight: '800' },
});