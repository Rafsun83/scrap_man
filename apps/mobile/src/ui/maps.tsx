import Constants from 'expo-constants';
import type { ComponentType } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from './components';
import { colors } from './theme';

type LatLng = { lat: number; lng: number };

/** True when the build has a Google Maps key (see app.config.ts). */
export const mapsEnabled = Constants.expoConfig?.extra?.mapsEnabled === true;

type MapsModule = typeof import('react-native-maps');

/** react-native-maps is loaded only when there is a key, so builds and tests without one never touch it. */
function loadMaps(): MapsModule | null {
  if (!mapsEnabled) return null;
  return require('react-native-maps') as MapsModule;
}

const toCoord = (p: LatLng) => ({ latitude: p.lat, longitude: p.lng });

function regionAround(points: LatLng[]) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const pad = 0.004;
  return {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta: Math.max(0.01, Math.max(...lats) - Math.min(...lats) + pad * 2),
    longitudeDelta: Math.max(0.01, Math.max(...lngs) - Math.min(...lngs) + pad * 2),
  };
}

function Pin({ icon, bg, fg }: { icon: 'home' | 'truck'; bg: string; fg: string }) {
  return (
    <View style={[s.pin, { backgroundColor: bg }]}>
      <Icon name={icon} size={20} color={fg} />
    </View>
  );
}

/** H6 map: the household's home and the collector's position. Null without a maps key. */
export function TrackingMap({
  home,
  collector,
  style,
  label,
}: {
  home: LatLng;
  collector: LatLng | null;
  style?: StyleProp<ViewStyle>;
  label: string;
}) {
  const maps = loadMaps();
  if (!maps) return null;
  const MapView = maps.default as unknown as ComponentType<Record<string, unknown>>;
  const { Marker } = maps;
  const points = collector ? [home, collector] : [home];
  return (
    <MapView
      style={style}
      provider={maps.PROVIDER_GOOGLE}
      region={regionAround(points)}
      accessibilityLabel={label}
      toolbarEnabled={false}
    >
      <Marker coordinate={toCoord(home)}>
        <Pin icon="home" bg={colors.signal} fg={colors.ink} />
      </Marker>
      {collector ? (
        <Marker coordinate={toCoord(collector)}>
          <Pin icon="truck" bg={colors.ink} fg={colors.signal} />
        </Marker>
      ) : null}
    </MapView>
  );
}

/** Address form: a draggable pin at the chosen point. Null without a maps key. */
export function PinPicker({ value, onChange, label }: { value: LatLng; onChange: (p: LatLng) => void; label: string }) {
  const maps = loadMaps();
  if (!maps) return null;
  const MapView = maps.default as unknown as ComponentType<Record<string, unknown>>;
  const { Marker } = maps;
  return (
    <MapView
      style={s.picker}
      provider={maps.PROVIDER_GOOGLE}
      initialRegion={{ ...toCoord(value), latitudeDelta: 0.004, longitudeDelta: 0.004 }}
      accessibilityLabel={label}
      toolbarEnabled={false}
    >
      <Marker
        draggable
        coordinate={toCoord(value)}
        onDragEnd={(e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) =>
          onChange({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })
        }
      >
        <Pin icon="home" bg={colors.signal} fg={colors.ink} />
      </Marker>
    </MapView>
  );
}

const s = StyleSheet.create({
  pin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  picker: { height: 220, borderRadius: 14, overflow: 'hidden' },
});
