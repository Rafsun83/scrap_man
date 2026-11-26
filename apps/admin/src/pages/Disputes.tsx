import { PageHead } from '../components/PageHead'
import { DISPUTE_TYPES, t as tApp, type AdminDispute, type Category } from '@bw/shared'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useCategories, useDisputes, usePickup, usePickupEvents, useResolveDispute, type DisputeOutcome, type DisputeType } from '../api/hooks'
import { WeighRoundsTable } from '../components/PickupDrawer'
import { TeamWeighForm } from '../components/TeamWeighForm'
import { Icon } from '../components/Icon'
import { Banner, Button, Empty, ErrorBox, Loading, StatusBadge } from '../components/ui'
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
      <PageHead title={t('navDisputes')} sub={t('disputesSub')} />
      <div className="row">
        <div className="tabs" role="group">
          {(['OPEN', 'RESOLVED'] as const).map((x) => (
            <button key={x} type="button" className="tab" aria-pressed={tab === x} onClick={() => setTab(x)}>
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
        <section className="panel">
          <Empty text={t('noDisputes')} />
        </section>
      ) : (
        <div className="split">
          <section className="list" aria-label={t('navDisputes')}>
            <div className="list-head">
              {t(tab === 'OPEN' ? 'tabOpen' : 'tabResolved')} · {localDigits(list.length, lang)}
            </div>
            {list.map((d) => (
              <button key={d.id} type="button" className="list-item" aria-current={selected?.id === d.id} onClick={() => select(d)} style={{ minHeight: 64 }}>
                <span className="body">
                  <span className="title">
                    {d.displayNo}
                    <span className={`badge ${d.type === 'WEIGHT' ? 'alert' : 'active'}`}>{t(`dtype_${d.type}`)}</span>
                  </span>
                  <span className="meta">{t('parties', { household: d.householdName ?? t('unnamed'), area: d.area, collector: d.collectorName ?? t('unnamed') })}</span>
                  <span className="meta">
                    {t(`dstatus_${d.status}`)} · {t('openedAt', { time: formatWhen(d.createdAt, lang) })}
                  </span>
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

  if (pickup.isPending) return <section className="panel detail"><Loading /></section>
  if (pickup.isError) return <section className="panel detail"><ErrorBox error={pickup.error} onRetry={() => void pickup.refetch()} /></section>
  const p = pickup.data
  const lastWeight = all.filter((x) => x.pickupId === d.pickupId && x.type === 'WEIGHT').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const teamWeigh = needsTeamWeigh(p, lastWeight?.outcome ?? null)
  const evidence = p.photos.filter((ph) => d.photoIds.includes(ph.id))
  const scales = p.photos.filter((ph) => ph.kind === 'SCALE')

  return (
    <div className="detail stack" style={{ gap: 20 }}>
      <section className="panel" style={{ padding: 24, gap: 20 }}>
        <div className="detail-head">
          <div className="titles">
            <h2 className="row" style={{ gap: 10 }}>
              {`${d.displayNo}: ${t(`dtype_${d.type}`)}`}
              <StatusBadge status={p.status} />
            </h2>
            <span>{t('parties', { household: d.householdName ?? t('unnamed'), area: d.area, collector: d.collectorName ?? t('unnamed') })}</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {p.household.phone ? (
              <a className="btn small" href={`tel:${p.household.phone}`} title={formatPhone(p.household.phone, lang)}>
                <Icon name="phone" />
                {t('callHousehold')}
              </a>
            ) : null}
            {p.collector?.phone ? (
              <a className="btn small" href={`tel:${p.collector.phone}`} title={formatPhone(p.collector.phone, lang)}>
                <Icon name="phone" />
                {t('callCollector')}
              </a>
            ) : null}
          </div>
        </div>

        <div className="reason">
          <span className="muted">{t('householdReason')}: </span>
          {d.reason ? <strong>“{d.reason}”</strong> : <span className="muted">{t('noReason')}</span>}
          {evidence.length > 0 ? (
            <div className="photos" style={{ marginTop: 10 }}>
              {evidence.map((ph) => (
                <a key={ph.id} href={ph.url} target="_blank" rel="noreferrer"><img src={ph.url} alt={t('householdPhotos')} /></a>
              ))}
            </div>
          ) : null}
        </div>

        {p.weighRounds.length > 0 ? <WeighRoundsTable p={p} categories={categories.data} /> : null}

        {d.type === 'PAYMENT' && p.payment ? (
          <dl className="tiles">
            <div>
              <dt>{t('amount')}</dt>
              <dd className="amount">{money(p.payment.amount, lang)}</dd>
            </div>
            <div>
              <dt>{t('method')}</dt>
              <dd>{tApp(`pay_${p.payment.method}`, lang)}</dd>
            </div>
            <div>
              <dt>{t('wallet')}</dt>
              <dd>{formatPhone(p.payment.walletNumber, lang)}</dd>
            </div>
            <div>
              <dt>{t('trxFromCollector')}</dt>
              <dd style={{ letterSpacing: '0.04em' }}>{p.payment.trxId ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('reportedAt')}</dt>
              <dd>{formatWhen(d.createdAt, lang)}</dd>
            </div>
          </dl>
        ) : null}

        <div className="evidence">
          {scales.length > 0 ? (
            <div className="photos" style={{ alignContent: 'flex-start' }}>
              {scales.map((ph) => (
                <figure key={ph.id} style={{ margin: 0 }}>
                  <a href={ph.url} target="_blank" rel="noreferrer"><img src={ph.url} alt={t('scalePhotoRound', { n: localDigits(ph.weighVersion ?? '', lang) })} /></a>
                  <figcaption className="muted">{t('scalePhotoRound', { n: localDigits(ph.weighVersion ?? '', lang) })}</figcaption>
                </figure>
              ))}
            </div>
          ) : null}
          <div className="stack" style={{ gap: 6 }}>
            <h3 style={{ fontSize: 13 }}>{t('timeline')}</h3>
            {events.data ? (
              <ol className="timeline">
                {events.data.map((e) => (
                  <li key={e.id} className={e.to === 'DISPUTED' ? 'alert' : undefined}>
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
          </div>
        </div>

        {d.status === 'ADMIN_REVIEW' ? (
          <ResolutionForm d={d} amount={p.totalAmount} outcome={outcome} setOutcome={setOutcome} note={note} setNote={setNote} resolve={resolve} pickupStatus={p.status} />
        ) : d.status === 'REWEIGH' ? (
          <Banner tone="warn">{t('waitingForCollector')}</Banner>
        ) : (
          <Banner tone="ok">
            {t('resolvedWith', { outcome: d.outcome ? t(`outcome_${d.outcome}`, { amount: money(p.totalAmount, lang) }) : '—' })}
            {d.resolutionNote ? <div>{t('noteValue', { note: d.resolutionNote })}</div> : null}
          </Banner>
        )}
      </section>

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
    <>
      <fieldset className="options">
        <legend>{t('resolution')}</legend>
        {options.map((o) => (
          <label key={o} className="radio">
            <input type="radio" name="outcome" value={o} checked={outcome === o} onChange={() => setOutcome(o)} />
            {t(`outcome_${o}`, { amount: money(amount, lang) })}
          </label>
        ))}
      </fieldset>
      <label className="field">
        {t('noteBothSides')}
        <textarea rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </label>
      {resolve.error ? <Banner tone="alert" role="alert">{errorMessage(resolve.error, lang)}</Banner> : null}
      <div className="actions-end">
        {!outcome || !note.trim() ? <span className="muted" style={{ fontSize: 14, marginRight: 'auto' }}>{t('pickOutcome')}</span> : null}
        {resolve.isSuccess ? (
          <span className="ok-text" role="status">
            <Icon name="checkCircle" />
            {t('resolvedDone')}
          </span>
        ) : null}
        <Button
          variant="primary"
          large
          icon="check"
          busy={resolve.isPending}
          disabled={!outcome || note.trim().length === 0}
          onClick={() => outcome && resolve.mutate({ id: d.id, pickupId: d.pickupId, outcome, note: note.trim() })}
        >
          {t('resolveDispute')}
        </Button>
      </div>
    </>
  )
}
