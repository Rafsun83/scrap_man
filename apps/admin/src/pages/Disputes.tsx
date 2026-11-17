import { DISPUTE_TYPES, t as tApp, type AdminDispute, type Category } from '@bw/shared'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useCategories, useDisputes, usePickup, usePickupEvents, useResolveDispute, type DisputeOutcome, type DisputeType } from '../api/hooks'
import { WeighRoundsTable } from '../components/PickupDrawer'
import { TeamWeighForm } from '../components/TeamWeighForm'
import { Button, Empty, ErrorBox, Loading, StatusBadge } from '../components/ui'
import { errorMessage } from '../lib/errors'
import { formatPhone, formatWhen, localDigits, money } from '../lib/format'
import { isOpen, needsTeamWeigh, outcomesFor } from '../lib/disputes'
import { useT } from '../lib/i18n'
import { eventLabel } from '../lib/timeline'

/** A4: disputes open first; the pickup's weigh rounds, photos, payment and timeline; the resolutions for the type. */
export function DisputesPage() {
  const { t, lang } = useT()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<'OPEN' | 'RESOLVED'>('OPEN')
  const [type, setType] = useState<DisputeType | undefined>()
  const all = useDisputes('ALL', type)
  const list = (all.data ?? []).filter((d) => (tab === 'OPEN' ? isOpen(d) : !isOpen(d)))
  const wanted = params.get('dispute') ?? params.get('pickup')
  const selected = list.find((d) => d.id === wanted || d.pickupId === wanted) ?? list[0] ?? null
  const select = (d: AdminDispute) => setParams({ dispute: d.id })

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('navDisputes')}</h1>
          <p className="muted">{t('disputesSub')}</p>
        </div>
      </div>
      <div className="row">
        <div className="chips" role="group">
          {(['OPEN', 'RESOLVED'] as const).map((x) => (
            <button key={x} type="button" className="chip" aria-pressed={tab === x} onClick={() => setTab(x)}>
              {t(x === 'OPEN' ? 'tabOpen' : 'tabResolved')}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <select aria-label={t('allTypes')} value={type ?? ''} onChange={(e) => setType((e.target.value || undefined) as DisputeType | undefined)}>
          <option value="">{t('allTypes')}</option>
          {DISPUTE_TYPES.map((x) => (
            <option key={x} value={x}>{t(`dtype_${x}`)}</option>
          ))}
        </select>
      </div>
      {all.isPending ? (
        <Loading />
      ) : all.isError ? (
        <ErrorBox error={all.error} onRetry={() => void all.refetch()} />
      ) : list.length === 0 ? (
        <Empty text={t('noDisputes')} />
      ) : (
        <div className="split">
          <section className="list">
            {list.map((d) => (
              <button key={d.id} type="button" className="list-item" aria-current={selected?.id === d.id} onClick={() => select(d)}>
                <strong>{`${d.displayNo}: ${t(`dtype_${d.type}`)}`}</strong>
                <span className="muted">{t('parties', { household: d.householdName ?? t('unnamed'), area: d.area, collector: d.collectorName ?? t('unnamed') })}</span>
                <span className="row" style={{ gap: 6 }}>
                  <span className={`badge ${d.status === 'RESOLVED' ? 'done' : d.status === 'ADMIN_REVIEW' ? 'alert' : 'active'}`}>{t(`dstatus_${d.status}`)}</span>
                  <span className="muted">{t('openedAt', { time: formatWhen(d.createdAt, lang) })}</span>
                </span>
              </button>
            ))}
          </section>
          {selected ? <DisputeDetail key={selected.id} d={selected} all={all.data ?? []} /> : <Empty text={t('selectDispute')} />}
        </div>
      )}
    </>
  )
}

function DisputeDetail({ d, all }: { d: AdminDispute; all: AdminDispute[] }) {
  const { t, lang } = useT()
  const pickup = usePickup(d.pickupId)
  const events = usePickupEvents(d.pickupId)
  const categories = useCategories()
  const resolve = useResolveDispute()
  const [outcome, setOutcome] = useState<DisputeOutcome | null>(null)
  const [note, setNote] = useState('')

  if (pickup.isPending) return <Loading />
  if (pickup.isError) return <ErrorBox error={pickup.error} onRetry={() => void pickup.refetch()} />
  const p = pickup.data
  const lastWeight = all.filter((x) => x.pickupId === d.pickupId && x.type === 'WEIGHT').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const teamWeigh = needsTeamWeigh(p, lastWeight?.outcome ?? null)
  const evidence = p.photos.filter((ph) => d.photoIds.includes(ph.id))
  const scales = p.photos.filter((ph) => ph.kind === 'SCALE')

  return (
    <div className="stack">
      <section className="panel">
        <div className="row">
          <h2>{`${d.displayNo}: ${t(`dtype_${d.type}`)}`}</h2>
          <StatusBadge status={p.status} />
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {t('parties', { household: d.householdName ?? t('unnamed'), area: d.area, collector: d.collectorName ?? t('unnamed') })}
        </p>
        <div className="row">
          {p.household.phone ? <a className="btn small" href={`tel:${p.household.phone}`}>☎ {t('callHousehold')} · {formatPhone(p.household.phone, lang)}</a> : null}
          {p.collector?.phone ? <a className="btn small" href={`tel:${p.collector.phone}`}>☎ {t('callCollector')} · {formatPhone(p.collector.phone, lang)}</a> : null}
        </div>
        <div>
          <strong>{t('householdReason')}: </strong>
          {d.reason ? <q>{d.reason}</q> : <span className="muted">{t('noReason')}</span>}
        </div>
        {evidence.length > 0 ? (
          <>
            <strong>{t('householdPhotos')}</strong>
            <div className="photos">
              {evidence.map((ph) => (
                <a key={ph.id} href={ph.url} target="_blank" rel="noreferrer"><img src={ph.url} alt={t('householdPhotos')} /></a>
              ))}
            </div>
          </>
        ) : null}
      </section>

      {p.weighRounds.length > 0 ? (
        <section className="panel">
          <h3>{t('weighRounds')}</h3>
          <WeighRoundsTable p={p} categories={categories.data} />
          <div className="photos">
            {scales.map((ph) => (
              <figure key={ph.id} style={{ margin: 0 }}>
                <a href={ph.url} target="_blank" rel="noreferrer"><img src={ph.url} alt={t('scalePhotoRound', { n: localDigits(ph.weighVersion ?? '', lang) })} /></a>
                <figcaption className="muted">{t('scalePhotoRound', { n: localDigits(ph.weighVersion ?? '', lang) })}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {d.type === 'PAYMENT' && p.payment ? (
        <section className="panel">
          <h3>{t('payment')}</h3>
          <dl className="kv">
            <dt>{t('amount')}</dt>
            <dd>{money(p.payment.amount, lang)}</dd>
            <dt>{t('method')}</dt>
            <dd>{tApp(`pay_${p.payment.method}`, lang)}</dd>
            <dt>{t('wallet')}</dt>
            <dd>{formatPhone(p.payment.walletNumber, lang)}</dd>
            <dt>{t('trxFromCollector')}</dt>
            <dd>{p.payment.trxId ?? '—'}</dd>
            <dt>{t('reportedAt')}</dt>
            <dd>{formatWhen(d.createdAt, lang)}</dd>
          </dl>
        </section>
      ) : null}

      <section className="panel">
        <h3>{t('timeline')}</h3>
        {events.data ? (
          <ol className="timeline">
            {events.data.map((e) => (
              <li key={e.id}>
                <time dateTime={e.at}>{formatWhen(e.at, lang)}</time>
                <span>{eventLabel(e, lang)}</span>
              </li>
            ))}
          </ol>
        ) : events.isError ? (
          <ErrorBox error={events.error} onRetry={() => void events.refetch()} />
        ) : (
          <Loading />
        )}
      </section>

      {d.status === 'ADMIN_REVIEW' ? (
        <ResolutionForm d={d} amount={p.totalAmount} outcome={outcome} setOutcome={setOutcome} note={note} setNote={setNote} resolve={resolve} pickupStatus={p.status} />
      ) : d.status === 'REWEIGH' ? (
        <div className="banner warn">{t('waitingForCollector')}</div>
      ) : (
        <div className="banner ok">
          {t('resolvedWith', { outcome: d.outcome ? t(`outcome_${d.outcome}`, { amount: money(p.totalAmount, lang) }) : '—' })}
          {d.resolutionNote ? <div className="muted">{t('noteValue', { note: d.resolutionNote })}</div> : null}
        </div>
      )}

      {teamWeigh ? <TeamWeighForm pickup={p} categories={categories.data as Category[] | undefined} /> : null}
    </div>
  )
}

function ResolutionForm({
  d,
  amount,
  outcome,
  setOutcome,
  note,
  setNote,
  resolve,
  pickupStatus,
}: {
  d: AdminDispute
  amount: number | null
  outcome: DisputeOutcome | null
  setOutcome: (o: DisputeOutcome) => void
  note: string
  setNote: (n: string) => void
  resolve: ReturnType<typeof useResolveDispute>
  pickupStatus: AdminDispute['pickupStatus']
}) {
  const { t, lang } = useT()
  const options = outcomesFor(d.type, pickupStatus)
  return (
    <section className="panel" aria-labelledby="resolution-title">
      <h3 id="resolution-title">{t('resolution')}</h3>
      {options.map((o) => (
        <label key={o} className="radio">
          <input type="radio" name="outcome" value={o} checked={outcome === o} onChange={() => setOutcome(o)} />
          {t(`outcome_${o}`, { amount: money(amount, lang) })}
        </label>
      ))}
      <label className="field">
        {t('noteBothSides')}
        <textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </label>
      {resolve.error ? <p className="alert" role="alert">{errorMessage(resolve.error, lang)}</p> : null}
      {resolve.isSuccess ? <div className="banner ok" role="status">{t('resolvedDone')}</div> : null}
      <Button
        variant="primary"
        busy={resolve.isPending}
        disabled={!outcome || note.trim().length === 0}
        onClick={() => outcome && resolve.mutate({ id: d.id, pickupId: d.pickupId, outcome, note: note.trim() })}
      >
        ✓ {t('resolveDispute')}
      </Button>
      {!outcome || !note.trim() ? <p className="muted" style={{ margin: 0 }}>{t('pickOutcome')}</p> : null}
    </section>
  )
}
