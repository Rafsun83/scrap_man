import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useRef } from 'react';
import { useSession } from '../auth/session';
import type {
  Address,
  AddressInput,
  Category,
  CreatePickup,
  MeSummary,
  NotificationPage,
  Dispute,
  DisputeType,
  PaymentMethod,
  Pickup,
  PickupFilter,
  PickupPage,
  TodayRates,
  UploadSlot,
  User,
} from './types';

export const keys = {
  categories: ['categories'] as const,
  rates: ['rates', 'today'] as const,
  me: ['me'] as const,
  addresses: ['me', 'addresses'] as const,
  myPickups: (filter: PickupFilter | 'ALL', limit?: number) => ['me', 'pickups', filter, limit ?? 'pages'] as const,
  allMyPickups: ['me', 'pickups'] as const,
  pickup: (id: string) => ['pickup', id] as const,
  summary: ['me', 'summary'] as const,
  notifications: ['me', 'notifications'] as const,
};

/**
 * One Idempotency-Key per intended action: the same key is reused while the body stays the same (so a
 * retry after a lost response is not done twice), and a new key is made when the body changes.
 */
export function useIdempotencyKey() {
  const ref = useRef<{ body: string; key: string } | null>(null);
  return {
    keyFor(body: unknown): string {
      const text = JSON.stringify(body ?? null);
      if (!ref.current || ref.current.body !== text) ref.current = { body: text, key: Crypto.randomUUID() };
      return ref.current.key;
    },
    reset() {
      ref.current = null;
    },
  };
}

export function useCategories() {
  const { api } = useSession();
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => api.request<Category[]>('GET', '/categories', { auth: false }),
    staleTime: 60 * 60 * 1000,
  });
}

export function useTodayRates() {
  const { api } = useSession();
  return useQuery({
    queryKey: keys.rates,
    queryFn: () => api.request<TodayRates>('GET', '/rates/today', { auth: false }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAddresses() {
  const { api } = useSession();
  return useQuery({ queryKey: keys.addresses, queryFn: () => api.request<Address[]>('GET', '/me/addresses') });
}

/** Default address first (the API orders them so). */
export function useDefaultAddress() {
  const q = useAddresses();
  return { ...q, address: q.data?.find((a) => a.isDefault) ?? q.data?.[0] ?? null };
}

export function useSaveAddress() {
  const { api } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: Partial<AddressInput> }) =>
      id
        ? api.request<Address>('PATCH', `/me/addresses/${id}`, { body: input })
        : api.request<Address>('POST', '/me/addresses', { body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.addresses }),
  });
}

export function useDeleteAddress() {
  const { api } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.request<void>('DELETE', `/me/addresses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.addresses }),
  });
}

export function useUpdateMe() {
  const { api, setUser } = useSession();
  return useMutation({
    mutationFn: (changes: { name?: string; language?: 'BN' | 'EN' }) => api.request<User>('PATCH', '/me', { body: changes }),
    onSuccess: (user) => setUser(user),
  });
}

/** H11 totals over completed pickups. */
export function useSummary() {
  const { api } = useSession();
  return useQuery({ queryKey: keys.summary, queryFn: () => api.request<MeSummary>('GET', '/me/summary') });
}

/** H13 feed, newest first, cursor paging. The first page also carries the unread count for the bell. */
export function useNotifications() {
  const { api } = useSession();
  return useInfiniteQuery({
    queryKey: keys.notifications,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.request<NotificationPage>('GET', '/me/notifications', { query: { limit: 20, cursor: pageParam } }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useMarkNotificationsRead() {
  const { api } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.request<void>('POST', '/me/notifications/read'),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  });
}

/** A short list (home: active banner, recent sales). */
export function useMyPickups(filter: PickupFilter, limit: number) {
  const { api } = useSession();
  return useQuery({
    queryKey: keys.myPickups(filter, limit),
    queryFn: () => api.request<PickupPage>('GET', '/me/pickups', { query: { status: filter, limit } }),
  });
}

/** History: cursor paging, newest first. */
export function useMyPickupPages(filter: PickupFilter | 'ALL') {
  const { api } = useSession();
  return useInfiniteQuery({
    queryKey: keys.myPickups(filter),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.request<PickupPage>('GET', '/me/pickups', {
        query: { status: filter === 'ALL' ? undefined : filter, limit: 20, cursor: pageParam },
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function usePickup(id: string) {
  const { api } = useSession();
  return useQuery({ queryKey: keys.pickup(id), queryFn: () => api.request<Pickup>('GET', `/pickups/${id}`) });
}

/** Stores the server's answer so the screen moves on without waiting for the socket event. */
function usePickupMutation<V>(fn: (vars: V) => Promise<Pickup>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (pickup) => {
      qc.setQueryData(keys.pickup(pickup.id), pickup);
      qc.invalidateQueries({ queryKey: keys.allMyPickups });
    },
  });
}

export function useCreatePickup() {
  const { api } = useSession();
  return usePickupMutation(({ body, key }: { body: CreatePickup; key: string }) =>
    api.request<Pickup>('POST', '/pickups', { body, idempotencyKey: key }),
  );
}

export function useCancelPickup(id: string) {
  const { api } = useSession();
  return usePickupMutation((reason?: string) =>
    api.request<Pickup>('POST', `/pickups/${id}/cancel`, { body: reason ? { reason } : {} }),
  );
}

export function useConfirmPickup(id: string) {
  const { api } = useSession();
  return usePickupMutation(
    ({ body, key }: { body: { paymentMethod: PaymentMethod; walletNumber?: string }; key: string }) =>
      api.request<Pickup>('POST', `/pickups/${id}/confirm`, { body, idempotencyKey: key }),
  );
}

export function useOpenDispute(id: string) {
  const { api } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { type: DisputeType; reason?: string; photoIds?: string[] }) =>
      api.request<Dispute>('POST', `/pickups/${id}/dispute`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.pickup(id) });
      qc.invalidateQueries({ queryKey: keys.allMyPickups });
    },
  });
}

export function useRateCollector(id: string) {
  const { api } = useSession();
  return useMutation({
    mutationFn: (body: { stars: number; comment?: string }) => api.request<void>('POST', `/pickups/${id}/rating`, { body }),
  });
}

/** Asks for an upload slot, then PUTs the file straight to storage. Returns the photo id. */
export function usePhotoUpload() {
  const { api } = useSession();
  return async (pickupId: string, file: { uri: string; mimeType?: string | null }): Promise<string> => {
    const contentType = file.mimeType === 'image/png' || file.mimeType === 'image/webp' ? file.mimeType : 'image/jpeg';
    const slot = await api.request<UploadSlot>('POST', `/pickups/${pickupId}/photos`, { body: { kind: 'ITEMS', contentType } });
    const blob = await (await fetch(file.uri)).blob();
    const res = await fetch(slot.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    return slot.photoId;
  };
}
