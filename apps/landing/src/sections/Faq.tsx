import type { LandingStringKey } from '@bw/shared'
import { Icon } from '../components/Icon'
import { SectionHeading } from '../components/SectionHeading'
import { useT } from '../lib/i18n'

const QUESTIONS: [LandingStringKey, LandingStringKey][] = [
  ['faq1Q', 'faq1A'],
  ['faq2Q', 'faq2A'],
  ['faq3Q', 'faq3A'],
  ['faq4Q', 'faq4A'],
  ['faq5Q', 'faq5A'],
  ['faq6Q', 'faq6A'],
]

export function Faq() {
  const { t } = useT()
  return (
    <section id="faq" className="section" aria-labelledby="faq-title">
      <div className="container faq-layout">
        <SectionHeading id="faq-title" kicker={t('faqKicker')} title={t('faqTitle')} />
        <div className="faq-list">
          {QUESTIONS.map(([q, a]) => (
            <details key={q} className="faq-item reveal">
              <summary>
                {t(q)}
                <span className="faq-chevron" aria-hidden="true">
                  <Icon name="chevronDown" size={18} />
                </span>
              </summary>
              <p>{t(a)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
