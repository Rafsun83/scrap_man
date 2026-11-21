import type { Category } from '@bw/shared'
import { buildRateBoard, type RateBoard, type TodayRates } from '../lib/rates'

/** Same origin by default: Vite proxies /api in development and nginx forwards it in production. */
export const API_BASE: string = import.meta.env.VITE_API_URL ?? '/api/v1'

async function getJson<T>(path: string, fetchImpl: typeof fetch): Promise<T> {
  const res = await fetchImpl(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`GET ${path} failed with ${res.status}`)
  return (await res.json()) as T
}

/** Today's rate board from the two public catalog endpoints. */
export async function fetchRateBoard(fetchImpl: typeof fetch = (input, init) => fetch(input, init)): Promise<RateBoard> {
  const [categories, today] = await Promise.all([
    getJson<Category[]>('/categories', fetchImpl),
    getJson<TodayRates>('/rates/today', fetchImpl),
  ])
  return buildRateBoard(categories, today)
}
