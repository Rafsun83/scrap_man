import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { keys, uploadPhoto, usePickupMutation, type LocalPhoto } from '../api/hooks';
import type { CollectorProfile, CollectorSignup, Ledger, NearbyRequest, PaymentMethod, Pickup, VehicleType, WorkArea } from '../api/types';
import { useSession } from '../auth/session';
import type { LatLng } from './location';

/**
 * The collector's own profile, or null before sign-up (the API answers 404 then).
 * Drives where the collector app opens: sign-up (C6), waiting (C7) or the work tabs.
 */
export function useCollectorProfile() {
  const { api } = useSession();
  return useQuery({
    queryKey: keys.collectorProfile,
    queryFn: async () => {
      try {
        return await api.request<CollectorProfile>('GET', '/collector/profile');
      } catch (error) {
        if (error instanceof ApiError && error.code === 'NOT_FOUND') return null;
        throw error;
      }
    },
  });
}

/** C6: uploads the selfie (private storage) and returns its photo id. */
export function useSelfieUpload() {
  const { api } = useSession();
  return (file: LocalPhoto) => uploadPhoto(api, '/collector/selfie', {}, file);
}

export function useSignUp() {
  const { api, user, setUser } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CollectorSignup) => api.request<CollectorProfile>('POST', '/collector/signup', { body }),
    onSuccess: (profile) => {
      qc.setQueryData(keys.collectorProfile, profile);
      if (user) setUser({ ...user, name: profile.name });
    },
  });
}

export function useUpdateWork() {
  const { api } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { workAreas?: WorkArea[]; vehicleType?: VehicleType; hasScale?: boolean }) =>
      api.request<CollectorProfile>('PATCH', '/collector/profile', { body }),
    onSuccess: (profile) => qc.setQueryData(keys.collectorProfile, profile),
  });
}

/** Online needs a location; the profile's isOnline follows. */
export function useSetOnline() {
  const { api } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ online, location }: { online: boolean; location?: LatLng }) =>
      api.request<void>('PUT', '/collector/status', { body: location ? { online, location } : { online } }),
    onSuccess: (_, { online }) => {
      qc.setQueryData<CollectorProfile | null>(keys.collectorProfile, (p) => (p ? { ...p, isOnline: online } : p));
      if (!online) qc.setQueryData<NearbyRequest[]>(keys.nearby, []);
      else qc.invalidateQueries({ queryKey: keys.nearby });
    },
  });
}

/** C1: open requests around the collector's position, nearest first. Live events keep it current. */
export function useNearby(location: LatLng | null, enabled: boolean) {
  const { api } = useSession();
  return useQuery({
    queryKey: keys.nearby,
    queryFn: () =>
      api.request<NearbyRequest[]>('GET', '/collector/requests/nearby', { query: { lat: location!.lat, lng: location!.lng } }),
    enabled: enabled && location !== null,
    refetchInterval: 60_000,
  });
}

export function useLedger(from: string, to: string) {
  const { api } = useSession();
  return useQuery({
    queryKey: keys.ledger(from, to),
    queryFn: () => api.request<Ledger>('GET', '/collector/ledger', { query: { from, to } }),
  });
}

/** C2: accept, first one wins. The nearby list drops the request either way once decided. */
export function useAccept() {
  const { api } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, key }: { id: string; key: string }) =>
      api.request<Pickup>('POST', `/pickups/${id}/accept`, { idempotencyKey: key }),
    onSuccess: (pickup) => {
      qc.setQueryData(keys.pickup(pickup.id), pickup);
      qc.invalidateQueries({ queryKey: keys.allMyPickups });
    },
    onSettled: (_, error, { id }) => {
      if (!error || (error instanceof ApiError && (error.code === 'ALREADY_TAKEN' || error.code === 'INVALID_STATE' || error.code === 'NOT_FOUND'))) {
        removeNearby(qc, id);
      }
    },
  });
}

export function removeNearby(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.setQueryData<NearbyRequest[]>(keys.nearby, (list) => list?.filter((r) => r.id !== id));
}

export function useRelease(id: string) {
  const { api } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => api.request<void>('POST', `/pickups/${id}/release`, { body: reason ? { reason } : {} }),
    onSuccess: () => {
      qc.removeQueries({ queryKey: keys.pickup(id) });
      qc.invalidateQueries({ queryKey: keys.allMyPickups });
      qc.invalidateQueries({ queryKey: keys.collectorProfile });
    },
  });
}

export function useArrive(id: string) {
  const { api } = useSession();
  return usePickupMutation((code: string) => api.request<Pickup>('POST', `/pickups/${id}/arrive`, { body: { code } }));
}

export function useRecordPayment(id: string) {
  const { api } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, key }: { body: { method: PaymentMethod; trxId?: string }; key: string }) =>
      api.request<Pickup>('POST', `/pickups/${id}/payment`, { body, idempotencyKey: key }),
    onSuccess: (pickup) => {
      qc.setQueryData(keys.pickup(pickup.id), pickup);
      qc.invalidateQueries({ queryKey: keys.allMyPickups });
      qc.invalidateQueries({ queryKey: keys.allLedgers });
    },
  });
}
