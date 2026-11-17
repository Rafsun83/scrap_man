import { ta, type Lang, type PickupStatus } from '@bw/shared'
import { ApiError } from '../api/client'

/** English shows the API's own message (written for people); Bangla uses our wording. */
export function errorMessage(error: unknown, lang: Lang): string {
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK') return ta('networkError', lang)
    if (lang === 'en' && error.message) return error.message
  }
  return ta('errGeneric', lang)
}

export function statusTone(status: PickupStatus): 'active' | 'done' | 'ended' | 'alert' {
  if (status === 'COMPLETED') return 'done'
  if (status === 'CANCELLED' || status === 'EXPIRED') return 'ended'
  if (status === 'DISPUTED') return 'alert'
  return 'active'
}

