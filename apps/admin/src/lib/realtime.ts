import type { QueryClient } from '@tanstack/react-query'
import { createContext, useContext } from 'react'
import { keys } from '../api/hooks'

/** Applies one live event to the admin caches. Admins receive every pickup event. Exported for tests. */
export function handleAdminEvent(qc: QueryClient, event: string, payload: unknown) {
  const pickupId = (payload as { pickupId?: string } | null)?.pickupId
  const invalidate = (key: readonly unknown[]) => void qc.invalidateQueries({ queryKey: key })
  if (event === 'collector.location') return // the map polls instead
  if (event === 'ops.alert') {
    invalidate(keys.alerts)
    return
  }
  if (event === 'rates.published') {
    invalidate(keys.allRates) // every date's A2 table, e.g. in another admin's tab
    return
  }
  if (event === 'collector.applied' || event === 'collector.verification') {
    invalidate(keys.allCollectors)
    invalidate(keys.overview)
    invalidate(keys.allUsers)
    return
  }
  if (event === 'dispute.opened' || event === 'dispute.resolved') {
    invalidate(keys.allDisputes)
  }
  if (event.startsWith('request.') || event.startsWith('pickup.') || event.startsWith('dispute.')) {
    invalidate(keys.overview)
    invalidate(keys.alerts)
    invalidate(keys.map)
    invalidate(keys.allPickups)
    if (pickupId) {
      invalidate(keys.pickup(pickupId))
      invalidate(keys.events(pickupId))
    }
  }
}

export const LiveContext = createContext(false)

/** Whether the live connection is up (the layout shows a note when it is not). */
export function useLive() {
  return useContext(LiveContext)
}
