import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json plus the Google Maps key, which stays out of git. Put GOOGLE_MAPS_API_KEY in apps/mobile/.env.local
 * (or the build environment). Without a key the app shows distance and ETA instead of a map (H6) and saves the
 * phone's GPS position without a draggable pin (address form). Push notifications stay off until GOOGLE_SERVICES_JSON
 * points at a Firebase config (M7).
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY?.trim() ?? '';
  // Push needs Firebase: GOOGLE_SERVICES_JSON is the path to google-services.json (kept out of git; M7).
  const googleServices = process.env.GOOGLE_SERVICES_JSON?.trim() ?? '';
  return {
    ...config,
    name: config.name!,
    slug: config.slug!,
    android: { ...config.android, ...(googleServices ? { googleServicesFile: googleServices } : {}) },
    plugins: [
      ...(config.plugins ?? []),
      ['react-native-maps', mapsKey ? { androidGoogleMapsApiKey: mapsKey, iosGoogleMapsApiKey: mapsKey } : {}],
      'expo-notifications',
    ],
    extra: { ...config.extra, mapsEnabled: mapsKey.length > 0, pushEnabled: googleServices.length > 0 },
  };
};
