import { t as tApp, type Category, type Pickup } from '@bw/shared'
import { useState } from 'react'
import { useCancelPickup, useCategories, usePickup, usePickupEvents } from '../api/hooks'
import { categoryName, formatDate, formatPhone, formatWhen, kg, localDigits, money } from '../lib/format'
import { useT } from '../lib/i18n'
import { eventLabel } from '../lib/timeline'
import { Banner, Button, Drawer, ErrorBox, Loading, StatusBadge } from './ui'
import { errorMessage } from '../lib/errors'

const ACTIVE = new Set(['REQUESTED', 'ACCEPTED', 'ARRIVED', 'WEIGHED', 'DISPUTED', 'CONFIRMED'])

/** A1 detail: the pickup as an admin sees it, photos, weigh rounds, payment, the timeline, and cancel with a reason. */
export function PickupDrawer({ pickupId, onClose }: { pickupId: string; onClose: () => void }) {
  const { t, lang } = useT()
  const pickup = usePickup(pickupId)
  const events = usePickupEvents(pickupId)
  const categories = useCategories()
  const cancel = useCancelPickup()
  const [reason, setReason] = useState('')

  const title = pickup.data ? t('pickupTitle', { no: pickup.data.displayNo }) : t('loading')
  return (
    <Drawer title={title} onClose={onClose}>
      {pickup.isPending ? (
        <Loading />
      ) : pickup.isError ? (
        <ErrorBox error={pickup.error} onRetry={() => void pickup.refetch()} />
      ) : (
        <PickupDetail p={pickup.data} categories={categories.data} />
      )}

      {pickup.data && ACTIVE.has(pickup.data.status) ? (
        <section className="panel">
          <h3>{t('cancelPickup')}</h3>
          <label className="field">
            {t('cancelReason')}
            <textarea value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
          </label>
          {cancel.error ? <Banner tone="alert" role="alert">{errorMessage(cancel.error, lang)}</Banner> : null}
          <Button
            variant="danger"
            icon="x"
            busy={cancel.isPending}
            disabled={reason.trim().length === 0}
            onClick={() => {
              if (window.confirm(t('cancelConfirm', { no: pickup.data!.displayNo }))) cancel.mutate({ id: pickupId, reason: reason.trim() })
            }}
          >
            {t('cancelPickup')}
          </Button>
        </section>
      ) : null}

      <section className="panel">
        <h3>{t('timeline')}</h3>
        {events.isPending ? (
          <Loading />
        ) : events.isError ? (
          <ErrorBox error={events.error} onRetry={() => void events.refetch()} />
        ) : (
          <ol className="timeline">
            {events.data.map((e) => (
              <li key={e.id}>
                <time dateTime={e.at}>{formatWhen(e.at, lang)}</time>
                <span>{eventLabel(e, lang)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </Drawer>
  )

}

/** The pickup's people, address, items, weigh rounds, payment and photos. */
function PickupDetail({ p, categories: cats }: { p: Pickup; categories: Category[] | undefined }) {
  const { t, lang } = useT()
  const items = p.categoryCodes.map((c) => categoryName(cats, c, lang)).join(', ')
  return (
    <>
      {p.codeLocked ? <Banner tone="alert">{t('codeLockedNote')}</Banner> : null}
      <section className="panel">
        <dl className="kv">
          <dt>{t('colStatus')}</dt>
          <dd><StatusBadge status={p.status} /></dd>
          <dt>{t('colHousehold')}</dt>
          <dd>
            {p.household.name ?? t('unnamed')} · {formatPhone(p.household.phone, lang)}{' '}
            {p.household.phone ? <a href={`tel:${p.household.phone}`}>{t('call')}</a> : null}
          </dd>
          <dt>{t('colCollector')}</dt>
          <dd>
            {p.collector ? (
              <>
                {p.collector.name ?? t('unnamed')} · {formatPhone(p.collector.phone, lang)}{' '}
                {p.collector.phone ? <a href={`tel:${p.collector.phone}`}>{t('call')}</a> : null}
              </>
            ) : (
              t('notYet')
            )}
          </dd>
          <dt>{t('address')}</dt>
          <dd>
            {p.address?.text ?? p.area}
            {p.address?.note ? <div className="muted">{p.address.note}</div> : null}
          </dd>
          <dt>{t('slot')}</dt>
          <dd>{`${formatDate(p.slotDate, lang)}, ${tApp(`slot_${p.slot}`, lang)}`}</dd>
          <dt>{t('colItems')}</dt>
          <dd>{items}</dd>
          <dt>{t('estWeight')}</dt>
          <dd>{tApp(`band_${p.weightBand}`, lang)}</dd>
        </dl>
      </section>

      {p.weighRounds.length > 0 ? (
        <section className="panel">
          <h3>{t('weighRounds')}</h3>
          <WeighRoundsTable p={p} categories={cats} />
        </section>
      ) : null}

      {p.payment ? (
        <section className="panel">
          <h3>{t('payment')}</h3>
          <dl className="kv">
            <dt>{t('amount')}</dt>
            <dd>{money(p.payment.amount, lang)}</dd>
            <dt>{t('method')}</dt>
            <dd>{tApp(`pay_${p.payment.method}`, lang)}</dd>
            {p.payment.walletNumber ? (
              <>
                <dt>{t('wallet')}</dt>
                <dd>{formatPhone(p.payment.walletNumber, lang)}</dd>
              </>
            ) : null}
            {p.payment.trxId ? (
              <>
                <dt>{t('trxFromCollector')}</dt>
                <dd>{p.payment.trxId}</dd>
              </>
            ) : null}
            <dt>{t('paidAt')}</dt>
            <dd>{formatWhen(p.payment.paidAt, lang)}</dd>
          </dl>
        </section>
      ) : null}

      {p.photos.length > 0 ? (
        <section className="panel">
          <h3>{t('photos')}</h3>
          <div className="photos">
            {p.photos.map((ph) => (
              <a key={ph.id} href={ph.url} target="_blank" rel="noreferrer">
                <img src={ph.url} alt={ph.kind === 'SCALE' ? t('scalePhotoRound', { n: localDigits(ph.weighVersion ?? '', lang) }) : t('householdPhotos')} />
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}

/** Every weigh round side by side (A4's "first weigh / re-weigh" table). */
export function WeighRoundsTable({ p, categories }: { p: Pickup; categories: Category[] | undefined }) {
  const { t, lang } = useT()
  const codes = [...new Set(p.weighRounds.flatMap((r) => r.lines.map((l) => l.categoryCode)))]
  return (
    <div className="framed">
      <table style={{ minWidth: 420 }}>
        <thead>
          <tr>
            <th>{t('colItem')}</th>
            {p.weighRounds.map((r) => (
              <th key={r.version} className="num">
                {t('roundN', { n: localDigits(r.version, lang) })} {r.weighedBy === 'ADMIN' ? t('byTeam') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {codes.map((code) => (
            <tr key={code}>
              <td>{categoryName(categories, code, lang)}</td>
              {p.weighRounds.map((r) => {
                const l = r.lines.find((x) => x.categoryCode === code)
                return (
                  <td key={r.version} className="num">
                    {l ? `${kg(l.kg, lang)} · ${money(l.amount, lang)}` : '—'}
                  </td>
                )
              })}
            </tr>
          ))}
          <tr className="total">
            <td>{t('total')}</td>
            {p.weighRounds.map((r, i) => (
              <td key={r.version} className={`num ${i === p.weighRounds.length - 1 ? 'money' : ''}`}>
                {`${kg(r.totalKg, lang)}, ${money(r.totalAmount, lang)}`}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
