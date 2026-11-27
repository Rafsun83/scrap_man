import { useEffect, useState } from 'react'
import { BrandMark } from '../components/BrandMark'
import { Icon } from '../components/Icon'
import { useLang, useT } from '../lib/i18n'
import type { LandingStringKey } from '@bw/shared'

const NAV: { href: string; label: LandingStringKey }[] = [
  { href: '#how', label: 'navHow' },
  { href: '#rates', label: 'navRates' },
  { href: '#items', label: 'navItems' },
  { href: '#safety', label: 'navSafety' },
  { href: '#collectors', label: 'navCollectors' },
  { href: '#faq', label: 'navFaq' },
]

export function Header() {
  const { t } = useT()
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
      <div className="container header-inner">
        <a className="brand" href="#top" aria-label={t('brand')}>
          <BrandMark size={40} />
          <span className="brand-text">
            <span className="brand-name">{t('brand')}</span>
            <span className="brand-sub">{t('brandSub')}</span>
          </span>
        </a>

        <nav id="site-nav" className={`site-nav${open ? ' open' : ''}`} aria-label={t('navMenu')}>
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {t(item.label)}
            </a>
          ))}
        </nav>

        <div className="header-actions">
          <button
            type="button"
            className="btn lang-btn"
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            aria-label={t('langToggleLabel')}
            lang={lang === 'bn' ? 'en' : 'bn'}
          >
            <Icon name="globe" size={20} />
            {t('langToggle')}
          </button>
          <button
            type="button"
            className="btn menu-btn"
            aria-expanded={open}
            aria-controls="site-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? 'close' : 'menu'} size={20} />
            {t('navMenu')}
          </button>
        </div>
      </div>
    </header>
  )
}
