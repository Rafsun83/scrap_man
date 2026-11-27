import { useT } from '../lib/i18n'
import { formatRate, trendOf, type RateRow } from '../lib/rates'
import { Icon } from './Icon'

/**
 * The rate board rows: name and price on one line, a thin rule between rows. `compact` (hero card) leaves out
 * the change from yesterday and categories without a per-kg rate.
 */
export function RateList({ rows, compact = false }: { rows: RateRow[]; compact?: boolean }) {
  const { t, lang } = useT()
  const shown = compact ? rows.filter((r) => r.ratePerKg !== null) : rows
  return (
    <ul className={`rate-list${compact ? ' compact' : ''}`}>
      {shown.map((row) => {
        const name = lang === 'bn' ? row.nameBn : row.nameEn
        const trend = trendOf(row.changeFromYesterday)
        const change = Math.abs(row.changeFromYesterday ?? 0)
        return (
          <li key={row.code} className="rate-row">
            <span className="rate-name">{name}</span>
            {row.ratePerKg !== null ? (
              <span className="rate-price">{formatRate(row.ratePerKg, lang)}</span>
            ) : (
              <span className="rate-price muted-price">{row.onInspection ? t('ratesOnInspection') : t('ratesNotSet')}</span>
            )}
            {!compact && row.ratePerKg !== null && trend ? (
              <span className={`rate-trend ${trend}`}>
                <Icon name={trend === 'up' ? 'arrowUp' : trend === 'down' ? 'arrowDown' : 'minus'} size={16} />
                {trend === 'same'
                  ? t('ratesSame')
                  : t(trend === 'up' ? 'ratesUp' : 'ratesDown', { amount: formatRate(change, lang) })}
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
