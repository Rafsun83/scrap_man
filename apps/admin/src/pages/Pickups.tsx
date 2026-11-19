import { localDigits, WORK_AREAS, type AttentionItem, type OpsAlert, type Pickup } from '@bw/shared'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAlerts, useCategories, useOverview, usePickups } from '../api/hooks'
import { filtersFor, type CardKey } from '../lib/pickupFilters'
import { PickupDrawer } from '../components/PickupDrawer'
import { categoryName } from '../lib/format'
import { PickupMap } from '../components/PickupMap'
import { Button, Empty, ErrorBox, Loading, StatusBadge } from '../components/ui'
import { formatLongDate, formatWhen, sinceParts } from '../lib/format'
import { useT } from '../lib/i18n'

const CARDS: { key: CardKey; label: 'countRequested' | 'countAccepted' | 'countWeighing' | 'countDisputed' | 'countConfirmed' | 'countCompletedToday'; count: 'requested' | 'accepted' | 'weighing' | 'disputed' | 'confirmed' | 'completedToday' }[] = [
  { key: 'REQUESTED', label: 'countRequested', count: 'requested' },
  { key: 'ACCEPTED', label: 'countAccepted', count: 'accepted' },
  { key: 'WEIGHING', label: 'countWeighing', count: 'weighing' },
  { key: 'DISPUTED', label: 'countDisputed', count: 'disputed' },
  { key: 'CONFIRMED', label: 'countConfirmed', count: 'confirmed' },
  { key: 'COMPLETED', label: 'countCompletedToday', count: 'completedToday' },
]

/** Waits until typing stops before searching. */
function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

/** A1: status counts as filters, what needs attention, the pickups table and the map. Live events keep it current. */
export function PickupsPage() {
  const { t, lang } = useT()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [card, setCard] = useState<CardKey | null>(null)
  const [today] = useState(() => new Date())
  const [area, setArea] = useState('')
  const [q, setQ] = useState('')
  const openId = params.get('pickup')
  const open = (id: string | null) => setParams(id ? { pickup: id } : {})

  const overview = useOverview()
  const alerts = useAlerts()
  const categories = useCategories()
  const searchArea = useDebounced(area)
  const searchQ = useDebounced(q)
  const pickups = usePickups(filtersFor(card, searchArea, searchQ))
  const rows = pickups.data?.pages.flatMap((p) => p.items ?? []) ?? []

  const duration = (since: string) => {
    const { minutes, h, m } = sinceParts(since)
    return h > 0 ? t('durationHours', { h: localDigits(h, lang), m: localDigits(m, lang) }) : t('durationMin', { n: localDigits(minutes, lang) })
  }
  const alertText = (a: OpsAlert) =>
    t(`alert_${a.kind}`, { no: a.displayNo ?? '', name: a.name ?? t('unnamed'), count: localDigits(a.count ?? 0, lang), duration: duration(a.since) })
  const attentionText = (a: AttentionItem) =>
    t(`att_${a.kind}`, { no: a.displayNo ?? '', area: a.area ?? '', name: a.name ?? t('unnamed'), count: localDigits(a.count ?? 0, lang), duration: duration(a.since) })

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('navPickups')}</h1>
          <p className="muted">{formatLongDate(today, lang)}</p>
        </div>
        <span className="spacer" />
        <input type="search" aria-label={t('searchPickups')} placeholder={t('searchPickups')} value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 280 }} />
        <input type="text" list="areas" aria-label={t('colArea')} placeholder={t('allAreas')} value={area} onChange={(e) => setArea(e.target.value)} />
        <datalist id="areas">
          {WORK_AREAS.map((a) => (
            <option key={a.code} value={a[lang]} />
          ))}
        </datalist>
      </div>

      <div className="counts" role="group" aria-label={t('colStatus')}>
        {CARDS.map((c) => (
          <button key={c.key} type="button" className="count-card" aria-pressed={card === c.key} onClick={() => setCard(card === c.key ? null : c.key)} data-testid={`count-${c.key}`}>
            <span className="n">{overview.data ? localDigits(overview.data.counts[c.count], lang) : '…'}</span>
            <span>{t(c.label)}</span>
          </button>
        ))}
      </div>

      {alerts.data && alerts.data.length > 0 ? (
        <section className="panel alerts" aria-labelledby="alerts-title" data-testid="alerts">
          <h2 id="alerts-title">{t('alertsTitle')}</h2>
          <ul className="attention">
            {alerts.data.map((a) => (
              <li key={a.id}>
                <span className={`badge ${a.severity === 'CRITICAL' ? 'alert' : 'active'}`}>{t(`severity_${a.severity}`)}</span>
                <span style={{ flex: 1 }}>{alertText(a)}</span>
                {a.pickupId ? (
                  <Button small onClick={() => open(a.pickupId)}>
                    → {t('view')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel" aria-labelledby="attention-title">
        <h2 id="attention-title">{t('needsAttention')}</h2>
        {overview.isPending ? (
          <Loading />
        ) : overview.isError ? (
          <ErrorBox error={overview.error} onRetry={() => void overview.refetch()} />
        ) : overview.data.attention.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>{t('nothingNeedsAttention')}</p>
        ) : (
          <ul className="attention">
            {overview.data.attention.map((a, i) => (
              <li key={`${a.kind}-${a.pickupId ?? a.userId}-${i}`}>
                <span className="dot" aria-hidden="true" />
                <span style={{ flex: 1 }}>{attentionText(a)}</span>
                <Button
                  small
                  onClick={() =>
                    a.kind === 'RELEASES'
                      ? navigate(`/users?role=COLLECTOR&q=${encodeURIComponent(a.name ?? '')}`)
                      : a.kind === 'DISPUTE_REVIEW'
                        ? navigate(`/disputes?pickup=${a.pickupId}`)
                        : open(a.pickupId)
                  }
                >
                  → {t('view')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid-2">
        <section className="panel" aria-labelledby="table-title">
          <div className="row">
            <h2 id="table-title">{card ? t(CARDS.find((c) => c.key === card)!.label) : t('allPickups')}</h2>
            <span className="spacer" />
            {card ? (
              <Button variant="link" onClick={() => setCard(null)}>
                {t('showAll')}
              </Button>
            ) : null}
          </div>
          {pickups.isPending ? (
            <Loading />
          ) : pickups.isError ? (
            <ErrorBox error={pickups.error} onRetry={() => void pickups.refetch()} />
          ) : rows.length === 0 ? (
            <Empty text={t('noPickups')} />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('colId')}</th>
                    <th>{t('colHousehold')}</th>
                    <th>{t('colArea')}</th>
                    <th>{t('colCollector')}</th>
                    <th>{t('colItems')}</th>
                    <th>{t('colStatus')}</th>
                    <th>{t('colUpdated')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p: Pickup) => (
                    <tr key={p.id} className="clickable" onClick={() => open(p.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open(p.id)}>
                      <td>{p.displayNo}</td>
                      <td>{p.household.name ?? t('unnamed')}</td>
                      <td>{p.area}</td>
                      <td>{p.collector ? (p.collector.name ?? t('unnamed')) : <span className="muted">{t('notYet')}</span>}</td>
                      <td>{p.categoryCodes.map((c) => categoryName(categories.data, c, lang)).join(', ')}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td>{formatWhen(p.updatedAt, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pickups.hasNextPage ? (
            <Button busy={pickups.isFetchingNextPage} onClick={() => void pickups.fetchNextPage()}>
              ↓ {t('showMore')}
            </Button>
          ) : null}
        </section>
        <PickupMap onOpen={open} />
      </div>

      {openId ? <PickupDrawer pickupId={openId} onClose={() => open(null)} /> : null}
    </>
  )
}
