import { formatDhakaLongDate } from '@bw/shared'
import { Icon } from '../components/Icon'
import { RateList } from '../components/RateList'
import { SectionHeading } from '../components/SectionHeading'
import type { RateBoardState } from '../hooks/useRateBoard'
import { useT } from '../lib/i18n'

/** Today's full rate board (H12 style) with loading, empty and error states. */
export function Rates({ rates, onRetry }: { rates: RateBoardState; onRetry: () => void }) {
  const { t, lang } = useT()
  return (
    <section id="rates" className="section tinted" aria-labelledby="rates-title">
      <div className="container rates-layout">
        <div>
          <SectionHeading id="rates-title" kicker={t('ratesKicker')} title={t('ratesTitle')} />
          <p className="lock-note reveal d1">
            <Icon name="lock" size={20} />
            {t('ratesLockNote')}
          </p>
        </div>
        <div className="rates-board reveal d1" aria-live="polite" aria-busy={rates.status === 'loading'}>
          <div className="rates-board-head">
            <span className="when">
              {rates.status === 'ready' ? <span className="live-dot" aria-hidden="true" /> : null}
              {rates.status === 'ready' && rates.board.effectiveDate
                ? t('ratesDate', { date: formatDhakaLongDate(rates.board.effectiveDate, lang) })
                : t('ratesTitle')}
            </span>
            <span className="muted">{t('ratesUnit')}</span>
          </div>
          {rates.status === 'loading' ? (
            <div className="rates-state">
              <span className="spinner" aria-hidden="true" />
              {t('ratesLoading')}
            </div>
          ) : rates.status === 'error' ? (
            <div className="rates-state">
              <p>{t('ratesError')}</p>
              <button type="button" className="btn dark" onClick={onRetry}>
                <Icon name="arrowRight" size={20} />
                {t('ratesRetry')}
              </button>
            </div>
          ) : rates.status === 'empty' ? (
            <div className="rates-state">
              <Icon name="calendar" size={32} />
              <p>{t('ratesEmpty')}</p>
            </div>
          ) : (
            <RateList rows={rates.board.rows} />
          )}
        </div>
      </div>
    </section>
  )
}
