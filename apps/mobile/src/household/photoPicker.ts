import { t, type Lang } from '@bw/shared';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import type { DraftPhoto } from './sellDraft';

const OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, allowsEditing: false };

async function pick(source: 'camera' | 'gallery', lang: Lang): Promise<DraftPhoto | null> {
  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(t('photoPermission', lang));
    return null;
  }
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(OPTIONS) : await ImagePicker.launchImageLibraryAsync(OPTIONS);
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, mimeType: asset.mimeType };
}

/** Asks camera or gallery, then returns the chosen photo (or null). */
export function choosePhoto(lang: Lang): Promise<DraftPhoto | null> {
  return new Promise((resolve) => {
    Alert.alert(t('addPhoto', lang), undefined, [
      { text: t('photoFromCamera', lang), onPress: () => pick('camera', lang).then(resolve, () => resolve(null)) },
      { text: t('photoFromGallery', lang), onPress: () => pick('gallery', lang).then(resolve, () => resolve(null)) },
      { text: t('cancel', lang), style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}
