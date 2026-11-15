import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json plus the Google Maps key, which stays out of git. Put GOOGLE_MAPS_API_KEY in apps/mobile/.env.local
 * (or the build environment). Without a key the app shows distance and ETA instead of a map (H6) and saves the
 * phone's GPS position without a draggable pin (address form).
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY?.trim() ?? '';
  return {
    ...config,
    name: config.name!,
    slug: config.slug!,
    plugins: [...(config.plugins ?? []), ['react-native-maps', mapsKey ? { androidGoogleMapsApiKey: mapsKey, iosGoogleMapsApiKey: mapsKey } : {}]],
    extra: { ...config.extra, mapsEnabled: mapsKey.length > 0 },
  };
};
