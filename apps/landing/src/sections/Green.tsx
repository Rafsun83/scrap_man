import type { LandingStringKey } from '@bw/shared'
import { Icon, type IconName } from '../components/Icon'
import { SectionHeading } from '../components/SectionHeading'
import { useT } from '../lib/i18n'

const IMPACTS: { icon: IconName; title: LandingStringKey; text: LandingStringKey }[] = [
  { icon: 'tree', title: 'greenPaperTitle', text: 'greenPaperText' },
  { icon: 'droplet', title: 'greenPlasticTitle', text: 'greenPlasticText' },
  { icon: 'shieldLeaf', title: 'greenEwasteTitle', text: 'greenEwasteText' },
  { icon: 'recycle', title: 'greenMetalTitle', text: 'greenMetalText' },
]

const CYCLE: { icon: IconName; label: LandingStringKey }[] = [
  { icon: 'home', label: 'greenCycle1' },
  { icon: 'truck', label: 'greenCycle2' },
  { icon: 'factory', label: 'greenCycle3' },
  { icon: 'sparkle', label: 'greenCycle4' },
]

/** Why selling scrap matters: what recycling each kind saves, where the scrap goes, and what it means for people. */
export function Green() {
  const { t } = useT()
  return (
    <section id="green" className="section green" aria-labelledby="green-title">
      <div className="container">
        <SectionHeading id="green-title" kicker={t('greenKicker')} title={t('greenTitle')} lead={t('greenLead')} />
        <ul className="impact-grid">
          {IMPACTS.map((item, i) => (
            <li key={item.title} className={`impact-card reveal d${i}`}>
              <span className="impact-icon">
                <Icon name={item.icon} size={24} />
              </span>
              <h3>{t(item.title)}</h3>
              <p>{t(item.text)}</p>
            </li>
          ))}
        </ul>

        <div className="green-bottom">
          <div className="cycle-card reveal">
            <h3>{t('greenCycleTitle')}</h3>
            <ol className="cycle">
              {CYCLE.map((c) => (
                <li key={c.label}>
                  <span className="cycle-icon">
                    <Icon name={c.icon} size={22} />
                  </span>
                  {t(c.label)}
                </li>
              ))}
            </ol>
          </div>
          <div className="people-card reveal d1">
            <span className="people-icon">
              <Icon name="heart" size={24} />
            </span>
            <h3>{t('greenPeopleTitle')}</h3>
            <p>{t('greenPeopleText')}</p>
            <p className="pledge">
              <Icon name="leaf" size={20} />
              {t('greenPledge')}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
