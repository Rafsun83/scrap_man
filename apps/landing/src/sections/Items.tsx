import type { LandingStringKey } from '@bw/shared'
import { Icon, type IconName } from '../components/Icon'
import { SectionHeading } from '../components/SectionHeading'
import { useT } from '../lib/i18n'

/** The six v1 categories (seed order and icons). Copy lives in the strings, so this works without the API. */
const ITEMS: { code: string; icon: IconName; name: LandingStringKey; hint: LandingStringKey }[] = [
  { code: 'IRON', icon: 'iron', name: 'item_IRON', hint: 'item_IRON_hint' },
  { code: 'NEWSPAPER', icon: 'newspaper', name: 'item_NEWSPAPER', hint: 'item_NEWSPAPER_hint' },
  { code: 'PLASTIC', icon: 'bottle', name: 'item_PLASTIC', hint: 'item_PLASTIC_hint' },
  { code: 'CARTON', icon: 'carton', name: 'item_CARTON', hint: 'item_CARTON_hint' },
  { code: 'ALUMINIUM', icon: 'can', name: 'item_ALUMINIUM', hint: 'item_ALUMINIUM_hint' },
  { code: 'ELECTRONICS', icon: 'device', name: 'item_ELECTRONICS', hint: 'item_ELECTRONICS_hint' },
]

export function Items() {
  const { t } = useT()
  return (
    <section id="items" className="section" aria-labelledby="items-title">
      <div className="container">
        <SectionHeading id="items-title" kicker={t('itemsKicker')} title={t('itemsTitle')} lead={t('itemsLead')} />
        <ul className="item-grid">
          {ITEMS.map((item, i) => (
            <li key={item.code} className={`item-card reveal d${i % 3}${item.code === 'ELECTRONICS' ? ' inspect' : ''}`}>
              <span className="item-icon">
                <Icon name={item.icon} size={28} />
              </span>
              <h3>{t(item.name)}</h3>
              <p>{t(item.hint)}</p>
            </li>
          ))}
        </ul>
        <p className="note reveal">
          <Icon name="scale" size={20} />
          {t('itemsMinimum')}
        </p>
      </div>
    </section>
  )
}
