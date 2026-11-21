import { localDigits, type LandingStringKey } from '@bw/shared'
import { Icon, type IconName } from '../components/Icon'
import { SectionHeading } from '../components/SectionHeading'
import { useT } from '../lib/i18n'

const POINTS: { icon: IconName; title: LandingStringKey; text: LandingStringKey }[] = [
  { icon: 'shield', title: 'safety1Title', text: 'safety1Text' },
  { icon: 'eyeOff', title: 'safety2Title', text: 'safety2Text' },
  { icon: 'key', title: 'safety3Title', text: 'safety3Text' },
  { icon: 'chat', title: 'safety4Title', text: 'safety4Text' },
]

export function Safety() {
  const { t, lang } = useT()
  return (
    <section id="safety" className="section tinted" aria-labelledby="safety-title">
      <div className="container safety-layout">
        <div className="safety-intro">
          <SectionHeading id="safety-title" kicker={t('safetyKicker')} title={t('safetyTitle')} />
          <div className="code-demo" aria-hidden="true">
            {localDigits('4729', lang).split('').map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
        </div>
        <ul className="safety-grid">
          {POINTS.map((p) => (
            <li key={p.title} className="safety-card">
              <span className="safety-icon">
                <Icon name={p.icon} size={26} />
              </span>
              <h3>{t(p.title)}</h3>
              <p>{t(p.text)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
