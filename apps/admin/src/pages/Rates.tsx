import { localDigits } from '@bw/shared'
import { useState } from 'react'
import { useCategories, usePublishRates, useRates } from '../api/hooks'
import { categoryName } from '../lib/format'
import { Button, ErrorBox, Loading } from '../components/ui'
import { errorMessage } from '../lib/errors'
import { dhakaDate, formatDate, formatLongDate, formatWhen, rate } from '../lib/format'
import { useT } from '../lib/i18n'
import { changedRates, changeFromPrevious, copyPrevious, draftFrom, invalidCodes, parseRate, type RateDraft } from '../lib/rates'

/**
 * A2: the rate per category for a date (today or later), next to the previous rate. Edits stay local until
 * published; a banner says so. Electronics are priced at the door.
 */
export function RatesPage() {
  const { t, lang } = useT()
  const today = dhakaDate()
  const [date, setDate] = useState(today)
  const rates = useRates(date)
  const categories = useCategories()
  const publish = usePublishRates()
  // Edits belong to one published version of one date; a new date or a new publish starts from what is published.
  const [edits, setEdits] = useState<{ key: string; draft: RateDraft } | null>(null)
  const [done, setDone] = useState(false)

  if (rates.isError) return <ErrorBox error={rates.error} onRetry={() => void rates.refetch()} />
  if (rates.isPending) return <Loading />

  const data = rates.data
  const version = `${data.date}|${data.publishedAt ?? ''}`
  const draft = edits?.key === version ? edits.draft : draftFrom(data)
  const setDraft = (next: RateDraft) => setEdits({ key: version, draft: next })
  const changes = changedRates(data, draft)
  const invalid = invalidCodes(draft)
  const past = date < today
  const set = (code: string, value: string) => {
    setDone(false)
    setDraft({ ...draft, [code]: value })
  }

  const onPublish = () => {
    if (!window.confirm(t('publishConfirm', { count: localDigits(changes.length, lang), date: formatDate(date, lang) }))) return
    publish.mutate({ effectiveDate: date, rates: changes }, { onSuccess: () => setDone(true) })
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('navRates')}</h1>
          <p className="muted">
            {formatLongDate(date, lang)}.{' '}
            {data.publishedAt ? t('publishedBy', { time: formatWhen(data.publishedAt, lang), name: data.publishedByName ?? t('unnamed') }) : t('notPublished')}
          </p>
        </div>
        <span className="spacer" />
        <label className="field">
          {t('rateDate')}
          <input type="date" value={date} min={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <Button onClick={() => setDraft(copyPrevious(data, draft))} disabled={past}>
          ⧉ {t('copyPrevious')}
        </Button>
        <Button variant="primary" busy={publish.isPending} disabled={past || changes.length === 0 || invalid.length > 0} onClick={onPublish}>
          ✓ {t('publishRates')}
        </Button>
      </div>

      {past ? <div className="banner alert">{t('pastDate')}</div> : null}
      {changes.length > 0 ? <div className="banner warn" role="status">{t('unpublishedBanner')}</div> : null}
      {done && changes.length === 0 ? <div className="banner ok" role="status">{t('ratesPublished')}</div> : null}
      {publish.error ? <div className="banner alert" role="alert">{errorMessage(publish.error, lang)}</div> : null}

      <section className="panel">
        <h2>{t('ratesPerKg')}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('colCategory')}</th>
                <th>{t('colPricing')}</th>
                <th className="num">{t('colPrevious')}</th>
                <th>{t('colRate')}</th>
                <th className="num">{t('colChange')}</th>
              </tr>
            </thead>
            <tbody>
              {data.rates.map((r) => {
                const other = lang === 'bn' ? 'en' : 'bn'
                const name = (
                  <>
                    <strong>{categoryName(categories.data, r.categoryCode, lang)}</strong>
                    <div className="muted">{categoryName(categories.data, r.categoryCode, other)}</div>
                  </>
                )
                if (r.pricingType === 'ON_INSPECTION') {
                  return (
                    <tr key={r.categoryCode}>
                      <td>{name}</td>
                      <td>{t('onInspection')}</td>
                      <td className="num">—</td>
                      <td colSpan={2} className="muted">{t('collectorQuotes')}</td>
                    </tr>
                  )
                }
                const value = draft[r.categoryCode] ?? ''
                const typed = parseRate(value)
                const bad = value.trim() !== '' && typed === null
                const change = changeFromPrevious(r.previousRate, typed)
                return (
                  <tr key={r.categoryCode}>
                    <td>{name}</td>
                    <td>{t('perKg')}</td>
                    <td className="num">
                      {rate(r.previousRate, lang)}
                      {r.previousDate ? <div className="muted">{t('fromDate', { date: formatDate(r.previousDate, lang) })}</div> : null}
                    </td>
                    <td>
                      <span className="row" style={{ gap: 4 }}>
                        ৳
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`${t('colRate')}: ${categoryName(categories.data, r.categoryCode, lang)}`}
                          aria-invalid={bad}
                          value={value}
                          disabled={past}
                          onChange={(e) => set(r.categoryCode, e.target.value)}
                          style={{ width: 110 }}
                          data-testid={`rate-${r.categoryCode}`}
                        />
                      </span>
                      {bad ? <div className="alert">{t('rateInvalid')}</div> : null}
                    </td>
                    <td className={`num ${change !== null && change < 0 ? 'alert' : change ? 'money' : ''}`}>
                      {change === null ? '—' : change === 0 ? t('noChange') : `${change > 0 ? '+' : '−'}${rate(Math.abs(change), lang)}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ margin: 0 }}>{t('ratesFooter')}</p>
      </section>
    </>
  )
}
