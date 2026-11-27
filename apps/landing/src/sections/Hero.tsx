import { formatDhakaDate } from '@bw/shared'
import { Icon } from '../components/Icon'
import { RateList } from '../components/RateList'
import type { RateBoardState } from '../hooks/useRateBoard'
import { useT } from '../lib/i18n'

/** Headline and the two calls to action; beside them the mascot and a card with today's live rates. */
export function Hero({ rates }: { rates: RateBoardState }) {
  const { t, lang } = useT()
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-bg" aria-hidden="true" />
      <div className="container hero-inner">
        <div className="hero-copy">
          <p className="pill reveal">
            <Icon name="pin" size={16} />
            {t('heroKicker')}
          </p>
          <h1 id="hero-title" className="reveal d1">{t('heroTitle')}</h1>
          <p className="hero-lead reveal d2">{t('heroLead')}</p>
          <div className="hero-ctas reveal d3">
            <a className="btn primary big" href="#rates">
              <Icon name="list" size={20} />
              {t('heroCtaRates')}
              <Icon name="arrowRight" size={18} className="arrow" />
            </a>
            <a className="btn big" href="#collectors">
              <Icon name="truck" size={20} />
              {t('heroCtaCollector')}
            </a>
          </div>
          <p className="app-soon reveal d3">
            <Icon name="phone" size={16} />
            {t('appSoon')}
          </p>
        </div>

        <div className="hero-art reveal d2">
          <div className="hero-disc" aria-hidden="true" />
          <img className="hero-mascot" src="/scale.png" alt="" width="360" height="360" />
          <div className="rate-card">
            <div className="rate-card-head">
              <h2>{t('heroCardTitle')}</h2>
              {rates.status === 'ready' && rates.board.effectiveDate ? (
                <span className="rate-card-date">
                  <span className="live-dot" aria-hidden="true" />
                  {formatDhakaDate(rates.board.effectiveDate, lang)}
                </span>
              ) : null}
            </div>
            <p className="rate-card-unit">{t('heroCardUnit')}</p>
            {rates.status === 'ready' ? (
              <RateList rows={rates.board.rows.slice(0, 5)} compact />
            ) : (
              <p className="rate-card-note">
                {rates.status === 'loading' ? t('ratesLoading') : rates.status === 'empty' ? t('ratesEmpty') : t('ratesError')}
              </p>
            )}
            <a className="rate-card-more" href="#rates">
              {t('heroCardMore')}
              <Icon name="arrowRight" size={18} />
            </a>
          </div>
          <p className="hero-chip">
            <span className="chip-icon">
              <Icon name="scale" size={22} />
            </span>
            {t('promiseWeigh')}
          </p>
        </div>
      </div>
    </section>
  )
}
