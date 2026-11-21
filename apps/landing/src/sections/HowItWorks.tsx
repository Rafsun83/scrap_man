import { localDigits, type LandingStringKey } from '@bw/shared'
import { Icon, type IconName } from '../components/Icon'
import { SectionHeading } from '../components/SectionHeading'
import { useT } from '../lib/i18n'

const STEPS: { icon: IconName; title: LandingStringKey; text: LandingStringKey }[] = [
  { icon: 'carton', title: 'how1Title', text: 'how1Text' },
  { icon: 'calendar', title: 'how2Title', text: 'how2Text' },
  { icon: 'key', title: 'how3Title', text: 'how3Text' },
  { icon: 'cash', title: 'how4Title', text: 'how4Text' },
]

export function HowItWorks() {
  const { t, lang } = useT()
  return (
    <section id="how" className="section" aria-labelledby="how-title">
      <div className="container">
        <SectionHeading id="how-title" kicker={t('howKicker')} title={t('howTitle')} />
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="step">
              <span className="step-no" aria-hidden="true">
                {localDigits(i + 1, lang)}
              </span>
              <span className="step-icon">
                <Icon name={s.icon} size={28} />
              </span>
              <h3>{t(s.title)}</h3>
              <p>{t(s.text)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
