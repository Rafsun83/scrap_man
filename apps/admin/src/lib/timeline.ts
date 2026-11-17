import { formatKg, formatTaka, localDigits, t, ta, type Lang, type PickupEvent } from '@bw/shared'

/** One readable line per status change, e.g. "accepted by Sohel Rana" or "weighed by Sohel Rana: 14.5 kg, ৳625". */
export function eventLabel(e: PickupEvent, lang: Lang): string {
  const name = e.actorName ?? (e.actorRole ? ta('unnamed', lang) : ta('system', lang))
  const meta = (e.meta ?? {}) as Record<string, unknown>
  const pay = (m: unknown) => (m === 'CASH' || m === 'BKASH' || m === 'NAGAD' ? t(`pay_${m}`, lang) : '—')
  if (e.from === null) return ta('ev_created', lang, { name })
  if (e.from === 'REQUESTED' && e.to === 'REQUESTED') {
    return ta('ev_widened', lang, { km: localDigits(Number(meta.searchRadiusM ?? 0) / 1000, lang) })
  }
  switch (e.to) {
    case 'ACCEPTED':
      return ta('ev_accepted', lang, { name })
    case 'REQUESTED':
      return ta('ev_released', lang, { name })
    case 'ARRIVED':
      return ta('ev_arrived', lang)
    case 'WEIGHED':
      return ta('ev_weighed', lang, {
        name,
        kg: meta.totalKg != null ? formatKg(Number(meta.totalKg), lang) : '—',
        amount: meta.totalAmount != null ? formatTaka(Number(meta.totalAmount), lang) : '—',
      })
    case 'DISPUTED':
      return ta('ev_disputed', lang)
    case 'CONFIRMED':
      return ta('ev_confirmed', lang, { method: pay(meta.paymentMethod) })
    case 'COMPLETED':
      return ta('ev_completed', lang, { method: pay(meta.method) })
    case 'CANCELLED':
      return ta('ev_cancelled', lang, { name })
    case 'EXPIRED':
      return ta('ev_expired', lang)
    default:
      return ta('ev_other', lang, { from: e.from ?? '—', to: e.to })
  }
}
