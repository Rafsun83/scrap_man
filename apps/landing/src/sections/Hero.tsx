import { formatDhakaDate } from '@bw/shared'
import { Icon } from '../components/Icon'
import type { RateBoardState } from '../hooks/useRateBoard'
import { useT } from '../lib/i18n'
import { formatRate } from '../lib/rates'

/**
 * Headline, the green promise and the two calls to action, with today's rates as a slim live strip; beside them
 * the mascot in full, ringed by what selling here means (weighed in front of you, paid on the spot, recycled).
 */
export function Hero({ rates }: { rates: RateBoardState }) {
  const { t, lang } = useT()
  const priced = rates.status === 'ready' ? rates.board.rows.filter((r) => r.ratePerKg !== null).slice(0, 4) : []
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
          <p className="hero-green reveal d2">
            <span className="hero-green-icon">
              <Icon name="leaf" size={18} />
            </span>
            {t('greenPledge')}
          </p>
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

          <div className="rate-strip reveal d3" aria-labelledby="hero-rates-title">
            <div className="rate-strip-head">
              <h2 id="hero-rates-title">{t('heroCardTitle')}</h2>
              {rates.status === 'ready' && rates.board.effectiveDate ? (
                <span className="rate-strip-date">
                  <span className="live-dot" aria-hidden="true" />
                  {formatDhakaDate(rates.board.effectiveDate, lang)}
                </span>
              ) : null}
              <span className="rate-strip-unit">{t('heroCardUnit')}</span>
            </div>
            {rates.status === 'ready' && priced.length > 0 ? (
              <ul className="rate-chips">
                {priced.map((row) => (
                  <li key={row.code}>
                    <span className="name">{lang === 'bn' ? row.nameBn : row.nameEn}</span>
                    <span className="price">{formatRate(row.ratePerKg!, lang)}</span>
                  </li>
                ))}
                <li className="more">
                  <a href="#rates">
                    {t('heroCardMore')}
                    <Icon name="arrowRight" size={16} />
                  </a>
                </li>
              </ul>
            ) : (
              <p className="rate-strip-note">
                {rates.status === 'loading' ? t('ratesLoading') : rates.status === 'error' ? t('ratesError') : t('ratesEmpty')}
              </p>
            )}
          </div>
        </div>

        <div className="hero-art reveal d2" aria-hidden="true">
          <div className="hero-orbit" />
          <div className="hero-badge">
            <img src="/scale.png" alt="" width="420" height="420" />
          </div>
          <p className="float-chip c1">
            <span className="chip-icon">
              <Icon name="scale" size={20} />
            </span>
            {t('promiseWeigh')}
          </p>
          <p className="float-chip c2">
            <span className="chip-icon cash">
              <Icon name="cash" size={20} />
            </span>
            {t('promisePaid')}
          </p>
          <p className="float-chip c3 green">
            <span className="chip-icon">
              <Icon name="recycle" size={20} />
            </span>
            {t('heroChipRecycle')}
          </p>
        </div>
      </div>
    </section>
  )
}
