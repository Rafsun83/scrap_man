import { t, type Lang } from '@bw/shared';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import type { LocalPhoto } from '../api/hooks';

/**
 * Takes a photo with the camera only (no gallery): the selfie (front camera) and the scale photo (back camera)
 * must be taken on the spot.
 */
export async function takePhoto(lang: Lang, camera: 'front' | 'back'): Promise<LocalPhoto | null> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('cameraPermission', lang));
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: false,
      cameraType: camera === 'front' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
    });
    const asset = result.canceled ? null : result.assets[0];
    return asset ? { uri: asset.uri, mimeType: asset.mimeType } : null;
  } catch {
    return null;
  }
}
