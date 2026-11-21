import { formatDhakaDate } from '@bw/shared'
import { Icon } from '../components/Icon'
import { RateList } from '../components/RateList'
import type { RateBoardState } from '../hooks/useRateBoard'
import { useT } from '../lib/i18n'

/** Headline, the two calls to action, and the H2-style yellow rate card filled with today's live rates. */
export function Hero({ rates }: { rates: RateBoardState }) {
  const { t, lang } = useT()
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container hero-inner">
        <div className="hero-copy">
          <p className="pill">
            <Icon name="pin" size={18} />
            {t('heroKicker')}
          </p>
          <h1 id="hero-title">{t('heroTitle')}</h1>
          <p className="hero-lead">{t('heroLead')}</p>
          <div className="hero-ctas">
            <a className="btn primary big" href="#rates">
              <Icon name="list" />
              {t('heroCtaRates')}
            </a>
            <a className="btn outline big" href="#collectors">
              <Icon name="truck" />
              {t('heroCtaCollector')}
            </a>
          </div>
          <p className="app-soon">
            <Icon name="phone" size={18} />
            {t('appSoon')}
          </p>
        </div>

        <div className="hero-art">
          <img className="hero-scale" src="/scale.png" alt="" width="220" height="220" />
          <div className="rate-card">
            <div className="rate-card-head">
              <h2>{t('heroCardTitle')}</h2>
              {rates.status === 'ready' && rates.board.effectiveDate ? (
                <span className="rate-card-date">{formatDhakaDate(rates.board.effectiveDate, lang)}</span>
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
        </div>
      </div>
      <div className="gamcha" aria-hidden="true" />
    </section>
  )
}
