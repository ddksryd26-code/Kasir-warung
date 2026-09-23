import * as FileSystem from 'expo-file-system/legacy';
import { Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

type ImageAsset = {
  uri: string;
  base64?: string | null;
  mimeType?: string;
};

export const mimeTypeFromUri = (uri: string) => {
  if (/\.png(?:\?|$)/i.test(uri)) return 'image/png';
  if (/\.webp(?:\?|$)/i.test(uri)) return 'image/webp';
  return 'image/jpeg';
};

const IMAGE_DIRECTORY = Platform.OS === 'web'
  ? null
  : `${Paths.document.uri}kasir-miso-images/`;
let imageSequence = 0;

function extensionForMimeType(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

async function ensureImageDirectory() {
  if (!IMAGE_DIRECTORY) throw new Error('Penyimpanan gambar perangkat tidak tersedia.');
  new Directory(Paths.document, 'kasir-miso-images').create({
    idempotent: true,
    intermediates: true,
  });
  return IMAGE_DIRECTORY;
}

export async function persistImageBase64(base64: string, mimeType = 'image/jpeg') {
  if (Platform.OS === 'web') {
    return `data:${mimeType};base64,${base64}`;
  }

  const directory = await ensureImageDirectory();
  imageSequence += 1;
  const filename = `image-${Date.now()}-${imageSequence}.${extensionForMimeType(mimeType)}`;
  const uri = `${directory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: 'base64' });
  return uri;
}

export async function persistImageAsset(asset: ImageAsset): Promise<string> {
  if (asset.base64) {
    return persistImageBase64(asset.base64, asset.mimeType || mimeTypeFromUri(asset.uri));
  }
  if (Platform.OS === 'web') return asset.uri;
  try {
    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
    return persistImageBase64(base64, asset.mimeType || mimeTypeFromUri(asset.uri));
  } catch {
    return asset.uri;
  }
}

export async function persistImageUri(uri: string | undefined) {
  if (!uri || /^https?:\/\//i.test(uri) || Platform.OS === 'web') {
    return uri;
  }

  if (uri.startsWith('data:')) {
    try {
      const image = await readImageAsBase64(uri);
      return persistImageBase64(image.base64, image.mimeType);
    } catch {
      return uri;
    }
  }

  // Keep native file URIs as file URIs. Expanding them to Base64 here would
  // put every image back into AsyncStorage during hydration.
  return uri;
}

export async function readImageAsBase64(uri: string) {
  if (uri.startsWith('data:')) {
    const separator = uri.indexOf(',');
    if (separator < 0) throw new Error('Format gambar tidak valid.');
    return {
      mimeType: uri.slice(5, separator).split(';', 1)[0] || 'image/jpeg',
      base64: uri.slice(separator + 1),
    };
  }
  if (/^https?:\/\//i.test(uri)) {
    throw new Error('Gambar online tidak bisa dimasukkan ke backup.');
  }
  if (Platform.OS === 'web') {
    throw new Error('Gambar web harus berupa data URI untuk dibackup.');
  }
  return {
    mimeType: mimeTypeFromUri(uri),
    base64: await FileSystem.readAsStringAsync(uri, { encoding: 'base64' }),
  };
}