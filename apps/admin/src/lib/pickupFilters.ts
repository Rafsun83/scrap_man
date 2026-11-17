import type { PickupFilters } from '../api/hooks'

export type CardKey = 'REQUESTED' | 'ACCEPTED' | 'WEIGHING' | 'DISPUTED' | 'CONFIRMED' | 'COMPLETED'

/** The table filter for a count card. */
export function filtersFor(card: CardKey | null, area: string, q: string): PickupFilters {
  const f: PickupFilters = {}
  if (card === 'WEIGHING') f.group = 'WEIGHING'
  else if (card) f.status = card
  if (area.trim()) f.area = area.trim()
  if (q.trim()) f.q = q.trim()
  return f
}

