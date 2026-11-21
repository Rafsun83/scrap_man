import type {
  AdminDispute,
  AdminMap,
  AdminOverview,
  AdminRates,
  AdminUserPage,
  Category,
  CollectorProfilePage,
  components,
  Pickup,
  PickupEvent,
  OpsAlert,
  PickupPage,
} from '@bw/shared'
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '../auth/session-context'

type S = components['schemas']
export type DisputeStatus = S['DisputeStatus']
export type DisputeType = S['DisputeType']
export type DisputeOutcome = S['DisputeOutcome']
export type VerificationStatus = S['VerificationStatus']
export type UserStatus = 'ACTIVE' | 'FLAGGED' | 'SUSPENDED'
export type PickupFilters = { status?: string; group?: string; area?: string; q?: string; userId?: string; date?: string }

export const keys = {
  all: ['admin'] as const,
  overview: ['admin', 'overview'] as const,
  alerts: ['admin', 'alerts'] as const,
  map: ['admin', 'map'] as const,
  pickups: (f: PickupFilters) => ['admin', 'pickups', f] as const,
  allPickups: ['admin', 'pickups'] as const,
  pickup: (id: string) => ['admin', 'pickup', id] as const,
  events: (id: string) => ['admin', 'pickup', id, 'events'] as const,
  rates: (date: string) => ['admin', 'rates', date] as const,
  allRates: ['admin', 'rates'] as const,
  categories: ['categories'] as const,
  collectors: (status: VerificationStatus) => ['admin', 'collectors', status] as const,
  allCollectors: ['admin', 'collectors'] as const,
  disputes: (status: DisputeStatus | 'OPEN' | 'ALL', type?: DisputeType) => ['admin', 'disputes', status, type ?? 'ALL'] as const,
  allDisputes: ['admin', 'disputes'] as const,
  users: (role: string, q: string) => ['admin', 'users', role, q] as const,
  allUsers: ['admin', 'users'] as const,
}

export function useCategories() {
  const { api } = useSession()
  return useQuery({ queryKey: keys.categories, queryFn: () => api.request<Category[]>('GET', '/categories', { auth: false }), staleTime: 3_600_000 })
}

export function useOverview() {
  const { api } = useSession()
  return useQuery({ queryKey: keys.overview, queryFn: () => api.request<AdminOverview>('GET', '/admin/overview'), refetchInterval: 60_000 })
}

/** Ops alerts; `ops.alert` events refresh them, and a minute's poll catches ones that clear. */
export function useAlerts() {
  const { api } = useSession()
  return useQuery({ queryKey: keys.alerts, queryFn: () => api.request<OpsAlert[]>('GET', '/admin/alerts'), refetchInterval: 60_000 })
}

export function useMap() {
  const { api } = useSession()
  // Collector pings are not pushed to admins; poll the map.
  return useQuery({ queryKey: keys.map, queryFn: () => api.request<AdminMap>('GET', '/admin/map'), refetchInterval: 30_000 })
}

export function usePickups(filters: PickupFilters) {
  const { api } = useSession()
  return useInfiniteQuery({
    queryKey: keys.pickups(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.request<PickupPage>('GET', '/admin/pickups', { query: { ...filters, limit: 20, cursor: pageParam } }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  })
}

export function usePickup(id: string | null) {
  const { api } = useSession()
  return useQuery({ queryKey: keys.pickup(id ?? ''), queryFn: () => api.request<Pickup>('GET', `/pickups/${id}`), enabled: !!id })
}

export function usePickupEvents(id: string | null) {
  const { api } = useSession()
  return useQuery({ queryKey: keys.events(id ?? ''), queryFn: () => api.request<PickupEvent[]>('GET', `/admin/pickups/${id}/events`), enabled: !!id })
}

/** After any admin action on a pickup: the pickup, its timeline, the lists and the counts. */
function useRefreshPickup() {
  const qc = useQueryClient()
  return (pickupId: string) => {
    void qc.invalidateQueries({ queryKey: keys.pickup(pickupId) })
    void qc.invalidateQueries({ queryKey: keys.events(pickupId) })
    void qc.invalidateQueries({ queryKey: keys.allPickups })
    void qc.invalidateQueries({ queryKey: keys.overview })
    void qc.invalidateQueries({ queryKey: keys.allDisputes })
  }
}

export function useCancelPickup() {
  const { api } = useSession()
  const refresh = useRefreshPickup()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.request<Pickup>('POST', `/admin/pickups/${id}/cancel`, { body: { reason } }),
    onSuccess: (p) => refresh(p.id),
  })
}

export function useRates(date: string) {
  const { api } = useSession()
  return useQuery({ queryKey: keys.rates(date), queryFn: () => api.request<AdminRates>('GET', '/admin/rates', { query: { date } }) })
}

export function usePublishRates() {
  const { api } = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { effectiveDate: string; rates: { categoryCode: string; ratePerKg: number }[] }) =>
      api.request<void>('PUT', '/admin/rates', { body }),
    onSuccess: (_, body) => void qc.invalidateQueries({ queryKey: keys.rates(body.effectiveDate) }),
  })
}

export function useCollectors(status: VerificationStatus) {
  const { api } = useSession()
  return useInfiniteQuery({
    queryKey: keys.collectors(status),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.request<CollectorProfilePage>('GET', '/admin/collectors', { query: { status, limit: 50, cursor: pageParam } }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

export function useDecideCollector() {
  const { api } = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, decision, note }: { userId: string; decision: 'APPROVED' | 'REJECTED'; note?: string }) =>
      api.request<void>('POST', `/admin/collectors/${userId}/decision`, { body: note ? { decision, note } : { decision } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.allCollectors })
      void qc.invalidateQueries({ queryKey: keys.overview })
      void qc.invalidateQueries({ queryKey: keys.allUsers })
    },
  })
}

export function useDisputes(status: DisputeStatus | 'OPEN' | 'ALL', type?: DisputeType) {
  const { api } = useSession()
  return useQuery({
    queryKey: keys.disputes(status, type),
    queryFn: async () => {
      const list = await api.request<AdminDispute[]>('GET', '/admin/disputes', {
        query: { status: status === 'OPEN' || status === 'ALL' ? undefined : status, type },
      })
      return status === 'OPEN' ? list.filter((d) => d.status !== 'RESOLVED') : list
    },
  })
}

export function useResolveDispute() {
  const { api } = useSession()
  const refresh = useRefreshPickup()
  return useMutation({
    mutationFn: ({ id, outcome, note }: { id: string; pickupId: string; outcome: DisputeOutcome; note: string }) =>
      api.request<S['Dispute']>('POST', `/admin/disputes/${id}/resolve`, { body: { outcome, note } }),
    onSuccess: (_, v) => refresh(v.pickupId),
  })
}

export function useTeamWeights() {
  const { api } = useSession()
  const refresh = useRefreshPickup()
  return useMutation({
    mutationFn: ({ pickupId, body, key }: { pickupId: string; body: S['WeightsInput']; key: string }) =>
      api.request<Pickup>('POST', `/pickups/${pickupId}/weights`, { body, idempotencyKey: key }),
    onSuccess: (p) => refresh(p.id),
  })
}

export function useUsers(role: 'HOUSEHOLD' | 'COLLECTOR', q: string) {
  const { api } = useSession()
  return useInfiniteQuery({
    queryKey: keys.users(role, q),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.request<AdminUserPage>('GET', '/admin/users', { query: { role, q, limit: 20, cursor: pageParam } }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  })
}

export function useSetUserStatus() {
  const { api } = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, status, note }: { userId: string; status: UserStatus; note?: string }) =>
      api.request<void>('PUT', `/admin/users/${userId}/status`, { body: note ? { status, note } : { status } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.allUsers })
      void qc.invalidateQueries({ queryKey: keys.map })
    },
  })
}
