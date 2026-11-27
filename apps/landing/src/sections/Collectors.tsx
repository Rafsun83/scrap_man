import { localDigits, type LandingStringKey } from '@bw/shared'
import { Icon } from '../components/Icon'
import { SectionHeading } from '../components/SectionHeading'
import { useT } from '../lib/i18n'

const PERKS: LandingStringKey[] = ['collectorsPerk1', 'collectorsPerk2', 'collectorsPerk3', 'collectorsPerk4']
const NEEDS: LandingStringKey[] = ['collectorsNeed1', 'collectorsNeed2', 'collectorsNeed3', 'collectorsNeed4']
const STEPS: LandingStringKey[] = ['collectorsStep1', 'collectorsStep2', 'collectorsStep3']

export function Collectors() {
  const { t, lang } = useT()
  return (
    <section id="collectors" className="section collectors-section" aria-labelledby="collectors-title">
      <div className="container">
      <div className="collectors-panel reveal">
      <div className="collectors-layout">
        <div>
          <SectionHeading
            id="collectors-title"
            tone="dark"
            kicker={t('collectorsKicker')}
            title={t('collectorsTitle')}
            lead={t('collectorsLead')}
          />
          <ul className="perk-list">
            {PERKS.map((key) => (
              <li key={key}>
                <Icon name="check" size={24} />
                {t(key)}
              </li>
            ))}
          </ul>
          <p className="app-soon on-dark">
            <Icon name="phone" size={18} />
            {t('appSoon')}
          </p>
        </div>

        <div className="collector-cards">
          <div className="collector-card">
            <h3>
              <Icon name="list" />
              {t('collectorsNeedTitle')}
            </h3>
            <ul className="need-list">
              {NEEDS.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
          </div>
          <div className="collector-card light">
            <h3>
              <Icon name="bolt" />
              {t('collectorsStepsTitle')}
            </h3>
            <ol className="mini-steps">
              {STEPS.map((key, i) => (
                <li key={key}>
                  <span className="mini-no" aria-hidden="true">
                    {localDigits(i + 1, lang)}
                  </span>
                  {t(key)}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
      </div>
      </div>
    </section>
  )
}
