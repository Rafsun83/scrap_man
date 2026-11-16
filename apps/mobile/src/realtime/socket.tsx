import { focusManager, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { keys } from '../api/hooks';
import type { NearbyRequest } from '../api/types';
import type { EventRequestTaken } from '@bw/shared';
import { useSession } from '../auth/session';
import { SOCKET_ORIGIN } from '../config';

/** Events that change a pickup; the payload carries pickupId and clients refetch the detail. */
export const PICKUP_EVENTS = [
  'request.expired',
  'pickup.accepted',
  'pickup.released',
  'pickup.arrived',
  'pickup.weighed',
  'pickup.confirmed',
  'pickup.disputed',
  'pickup.paid',
  'pickup.cancelled',
  'dispute.opened',
  'dispute.resolved',
] as const;

type Location = { lat: number; lng: number; at: string };

/** Last collector position per pickup, from `collector.location` (sent to the household while ACCEPTED). */
const locations = new Map<string, Location>();
const listeners = new Set<() => void>();

export function setCollectorLocation(pickupId: string, loc: Location) {
  locations.set(pickupId, loc);
  listeners.forEach((l) => l());
}

export function useCollectorLocation(pickupId: string): Location | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => locations.get(pickupId) ?? null,
  );
}

/** C1's nearby list: a new request is added (nearest first), a taken one removed. Only once the list is loaded. */
function applyNearby(qc: QueryClient, event: string, payload: unknown) {
  if (event === 'request.created') {
    const req = payload as NearbyRequest;
    qc.setQueryData<NearbyRequest[]>(keys.nearby, (list) =>
      list ? [...list.filter((r) => r.id !== req.id), req].sort((a, b) => a.distanceM - b.distanceM) : list,
    );
  } else {
    const { pickupId } = payload as EventRequestTaken;
    qc.setQueryData<NearbyRequest[]>(keys.nearby, (list) => list?.filter((r) => r.id !== pickupId));
  }
}

/** Applies one live event to the query cache. Exported for tests. */
export function handleEvent(qc: QueryClient, event: string, payload: unknown) {
  if (event === 'request.created' || event === 'request.taken') {
    applyNearby(qc, event, payload);
    return;
  }
  if (event === 'collector.verification') {
    qc.invalidateQueries({ queryKey: keys.collectorProfile });
    return;
  }
  if (event === 'collector.location') {
    const p = payload as { pickupId: string } & Location;
    setCollectorLocation(p.pickupId, { lat: p.lat, lng: p.lng, at: p.at });
    return;
  }
  if ((PICKUP_EVENTS as readonly string[]).includes(event)) {
    const pickupId = (payload as { pickupId?: string }).pickupId;
    if (pickupId) qc.invalidateQueries({ queryKey: keys.pickup(pickupId) });
    qc.invalidateQueries({ queryKey: keys.allMyPickups });
    // The notification feed and the history totals are built from the same events.
    qc.invalidateQueries({ queryKey: keys.notifications });
    qc.invalidateQueries({ queryKey: keys.summary });
    // The collector's ledger and 30-day counts change when a payment lands.
    if (event === 'pickup.paid') {
      qc.invalidateQueries({ queryKey: keys.allLedgers });
      qc.invalidateQueries({ queryKey: keys.collectorProfile });
    }
  }
}

/**
 * Keeps one Socket.IO connection while signed in. Events refresh the affected pickup; when the app returns
 * to the foreground or the socket reconnects, every screen refetches so nothing missed while away is lost.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { status, accessToken, api } = useSession();

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (status !== 'signedIn') return;
    const socket: Socket = io(SOCKET_ORIGIN, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: (cb) => cb({ token: accessToken() }),
    });
    let reconnecting = false;
    socket.on('unauthorized', async () => {
      // The access token expired: refresh it once, then reconnect with the new one.
      if (reconnecting) return;
      reconnecting = true;
      if (await api.refresh()) socket.connect();
      reconnecting = false;
    });
    socket.on('ready', () => qc.invalidateQueries());
    socket.onAny((event: string, payload: unknown) => handleEvent(qc, event, payload));
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [status, accessToken, api, qc]);

  return children;
}
