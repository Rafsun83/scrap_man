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

/** Tag colour per status (version 1): requested yellow, accepted blue-grey, in progress grey, disputed red, done green. */
export function statusTone(status: PickupStatus): 'active' | 'info' | 'neutral' | 'done' | 'ended' | 'alert' {
  if (status === 'REQUESTED') return 'active'
  if (status === 'ACCEPTED') return 'info'
  if (status === 'COMPLETED') return 'done'
  if (status === 'CANCELLED' || status === 'EXPIRED') return 'ended'
  if (status === 'DISPUTED') return 'alert'
  return 'neutral'
}
