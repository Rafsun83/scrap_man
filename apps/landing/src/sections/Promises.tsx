import type { LandingStringKey } from '@bw/shared'
import { Icon, type IconName } from '../components/Icon'
import { useT } from '../lib/i18n'

const PROMISES: { icon: IconName; title: LandingStringKey; text: LandingStringKey }[] = [
  { icon: 'list', title: 'promiseRate', text: 'promiseRateText' },
  { icon: 'scale', title: 'promiseWeigh', text: 'promiseWeighText' },
  { icon: 'checkCircle', title: 'promiseApprove', text: 'promiseApproveText' },
  { icon: 'cash', title: 'promisePaid', text: 'promisePaidText' },
]

/** The four promises right under the hero. */
export function Promises() {
  const { t } = useT()
  return (
    <section className="promises" aria-label={t('brandSub')}>
      <ul className="container promise-grid">
        {PROMISES.map((p) => (
          <li key={p.title} className="promise">
            <span className="promise-icon">
              <Icon name={p.icon} />
            </span>
            <span>
              <strong>{t(p.title)}</strong>
              <span className="promise-text">{t(p.text)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
