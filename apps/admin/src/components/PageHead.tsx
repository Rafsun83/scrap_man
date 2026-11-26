import type { ReactNode } from 'react'
import { useLang, useT } from '../lib/i18n'
import { Button } from './ui'

/** Page title (with an optional date line above and a sub line below) and the page's actions, ending with the language button. */
export function PageHead({ title, eyebrow, sub, children }: { title: string; eyebrow?: ReactNode; sub?: string; children?: ReactNode }) {
  const { t, lang } = useT()
  const { setLang } = useLang()
  const other = lang === 'en' ? 'bn' : 'en'
  return (
    <header className="page-head">
      <div className="titles">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      <div className="actions">
        {children}
        <Button icon="globe" lang={other} onClick={() => setLang(other)}>
          {t('langToggle')}
        </Button>
      </div>
    </header>
  )
}
