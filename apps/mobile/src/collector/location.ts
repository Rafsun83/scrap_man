import * as Location from 'expo-location';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { ApiClient } from '../api/client';

export type LatLng = { lat: number; lng: number };

/** How often the app sends the collector's position while online or on the way (contract: about 30 s). */
export const PING_INTERVAL_MS = 30_000;

let last: LatLng | null = null;
const listeners = new Set<() => void>();

function setLast(next: LatLng) {
  last = next;
  listeners.forEach((l) => l());
}

/** The collector's last known position on this phone, or null before the first fix. */
export function useLastPosition(): LatLng | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => last,
  );
}

export type PositionResult = { ok: true; position: LatLng } | { ok: false; reason: 'denied' | 'unavailable' };

/** Asks for foreground location permission if needed, then reads the position once. */
export async function currentPosition(): Promise<PositionResult> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'denied' };
    const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const position = { lat: fix.coords.latitude, lng: fix.coords.longitude };
    setLast(position);
    return { ok: true, position };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

/** Reads the position and sends it to PUT /collector/location. Failures are skipped; the next ping retries. */
export async function sendPing(api: ApiClient): Promise<void> {
  const result = await currentPosition();
  if (!result.ok) return;
  await api.request<void>('PUT', '/collector/location', { body: result.position }).catch(() => {});
}

/**
 * While `active` (online, or with an ACCEPTED pickup the household is tracking), pings every 30 seconds and
 * whenever the app returns to the foreground. Only while the app is open: background tracking needs Play Store
 * approval and is decided in M6.
 */
export function useLocationPings(active: boolean, api: ApiClient) {
  useEffect(() => {
    if (!active) return;
    void sendPing(api);
    const timer = setInterval(() => void sendPing(api), PING_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sendPing(api);
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [active, api]);
}
