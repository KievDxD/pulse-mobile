import * as ImagePicker from 'expo-image-picker';
import type { Coordinates, PhotoEvidence } from '../types/operations';

export interface PhotoCaptureResult {
  ok: boolean;
  cancelled?: boolean;
  evidence?: PhotoEvidence;
  error?: string;
}

function summarizeExif(
  exif: Record<string, unknown> | null | undefined,
  width: number,
  height: number
): string {
  if (!exif || typeof exif !== 'object') {
    return `${width}x${height} JPEG`;
  }
  const make = typeof exif.Make === 'string' ? exif.Make.trim() : '';
  const model = typeof exif.Model === 'string' ? exif.Model.trim() : '';
  const dt =
    typeof exif.DateTimeOriginal === 'string'
      ? exif.DateTimeOriginal.trim()
      : typeof exif.DateTime === 'string'
      ? exif.DateTime.trim()
      : '';
  const cameraTag = [make, model].filter(Boolean).join(' ');
  const parts = [cameraTag || `${width}x${height}`, dt].filter(Boolean);
  return parts.join(' • ') || `${width}x${height} EXIF`;
}

export function buildPhotoEvidenceFromAsset(
  asset: Pick<ImagePicker.ImagePickerAsset, 'uri' | 'width' | 'height' | 'fileSize' | 'exif'>,
  coords: Coordinates | null
): PhotoEvidence {
  const exifObj = asset.exif as Record<string, unknown> | null | undefined;
  const exifLat =
    exifObj && typeof exifObj.GPSLatitude === 'number' ? exifObj.GPSLatitude : null;
  const exifLng =
    exifObj && typeof exifObj.GPSLongitude === 'number' ? exifObj.GPSLongitude : null;

  return {
    uri: asset.uri,
    width: asset.width ?? 0,
    height: asset.height ?? 0,
    capturedAt: new Date().toISOString(),
    fileSizeBytes: typeof asset.fileSize === 'number' ? asset.fileSize : null,
    gpsLatitude: exifLat ?? coords?.latitude ?? null,
    gpsLongitude: exifLng ?? coords?.longitude ?? null,
    exifSummary: summarizeExif(exifObj, asset.width ?? 0, asset.height ?? 0),
  };
}

/**
 * Captures compressed photographic evidence using the device's physical camera with EXIF & GPS tags.
 */
export async function captureEvidencePhoto(
  coords: Coordinates | null
): Promise<PhotoCaptureResult> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return {
        ok: false,
        error: 'Camera permission denied. Use Attach From Device or grant camera access.',
      };
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      exif: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { ok: false, cancelled: true };
    }

    return {
      ok: true,
      evidence: buildPhotoEvidenceFromAsset(result.assets[0], coords),
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `${err.message}. Try attaching an image from device storage.`
          : 'Camera capture unavailable on this host.',
    };
  }
}

/**
 * Selects a compressed photographic evidence image from the device media library / file picker.
 */
export async function pickEvidencePhotoFromLibrary(
  coords: Coordinates | null
): Promise<PhotoCaptureResult> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return {
        ok: false,
        error: 'Media library permission denied.',
      };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      exif: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { ok: false, cancelled: true };
    }

    return {
      ok: true,
      evidence: buildPhotoEvidenceFromAsset(result.assets[0], coords),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to pick photo evidence.',
    };
  }
}
