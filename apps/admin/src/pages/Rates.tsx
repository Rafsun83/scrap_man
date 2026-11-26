import { PageHead } from '../components/PageHead'
import { localDigits } from '@bw/shared'
import { useState } from 'react'
import { useCategories, usePublishRates, useRates } from '../api/hooks'
import { categoryName } from '../lib/format'
import { Banner, Button, ErrorBox, Loading } from '../components/ui'
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
      <PageHead
        title={t('navRates')}
        eyebrow={
          <>
            {formatLongDate(date, lang)} ·{' '}
            {data.publishedAt ? t('publishedBy', { time: formatWhen(data.publishedAt, lang), name: data.publishedByName ?? t('unnamed') }) : t('notPublished')}
          </>
        }
      >
          <label className="field inline">
            {t('rateDate')}
            <input type="date" value={date} min={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
          <Button icon="copy" onClick={() => setDraft(copyPrevious(data, draft))} disabled={past}>
            {t('copyPrevious')}
          </Button>
          <Button variant="primary" icon="check" busy={publish.isPending} disabled={past || changes.length === 0 || invalid.length > 0} onClick={onPublish}>
            {t('publishRates')}
          </Button>
      </PageHead>

      {past ? <Banner tone="alert">{t('pastDate')}</Banner> : null}
      {changes.length > 0 ? <Banner tone="warn" role="status">{t('unpublishedBanner')}</Banner> : null}
      {done && changes.length === 0 ? <Banner tone="ok" role="status">{t('ratesPublished')}</Banner> : null}
      {publish.error ? <Banner tone="alert" role="alert">{errorMessage(publish.error, lang)}</Banner> : null}

      <section className="card">
        <h2 className="card-head sub" style={{ fontFamily: 'inherit', margin: 0 }}>{t('ratesPerKg')}</h2>
        <div className="table-wrap">
          <table style={{ minWidth: 600, fontSize: 15 }}>
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
                    <div style={{ fontWeight: 600 }}>{categoryName(categories.data, r.categoryCode, lang)}</div>
                    <div className="sub-line" style={{ fontSize: 13 }}>{categoryName(categories.data, r.categoryCode, other)}</div>
                  </>
                )
                if (r.pricingType === 'ON_INSPECTION') {
                  return (
                    <tr key={r.categoryCode}>
                      <td>{name}</td>
                      <td className="muted">{t('onInspection')}</td>
                      <td className="num muted">—</td>
                      <td colSpan={2} className="muted">{t('collectorQuotes')}</td>
                    </tr>
                  )
                }
                const value = draft[r.categoryCode] ?? ''
                const typed = parseRate(value)
                const bad = value.trim() !== '' && typed === null
                const change = changeFromPrevious(r.previousRate, typed)
                const changed = value !== (r.rate == null ? '' : String(r.rate))
                return (
                  <tr key={r.categoryCode}>
                    <td>{name}</td>
                    <td className="muted">{t('perKg')}</td>
                    <td className="num muted">
                      {rate(r.previousRate, lang)}
                      {r.previousDate ? <div className="sub-line">{t('fromDate', { date: formatDate(r.previousDate, lang) })}</div> : null}
                    </td>
                    <td>
                      <label className={`rate-field ${bad ? 'bad' : changed ? 'changed' : ''}`}>
                        ৳
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`${t('colRate')}: ${categoryName(categories.data, r.categoryCode, lang)}`}
                          aria-invalid={bad}
                          value={value}
                          disabled={past}
                          onChange={(e) => set(r.categoryCode, e.target.value)}
                          data-testid={`rate-${r.categoryCode}`}
                        />
                      </label>
                      {bad ? <div className="alert" style={{ fontSize: 13, marginTop: 4 }}>{t('rateInvalid')}</div> : null}
                    </td>
                    <td className="num">
                      {change === null ? (
                        <span className="muted">—</span>
                      ) : (
                        <span className={`change ${change > 0 ? 'up' : change < 0 ? 'down' : ''}`}>
                          {change === 0 ? t('noChange') : `${change > 0 ? '+' : '−'}${rate(Math.abs(change), lang)}`}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      <p className="note">{t('ratesFooter')}</p>
    </>
  )
}
