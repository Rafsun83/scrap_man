import { localDigits } from '@bw/shared'
import { BrandMark } from '../components/BrandMark'
import { Icon } from '../components/Icon'
import { useT } from '../lib/i18n'

/** Read once at load: the page is static and the year rarely changes while it is open. */
const YEAR = new Date().getFullYear()

export function Footer() {
  const { t, lang } = useT()
  return (
    <footer className="site-footer">
      <div className="gamcha" aria-hidden="true" />
      <div className="container footer-inner">
        <div className="brand">
          <BrandMark size={40} />
          <span className="brand-text">
            <span className="brand-name">{t('brand')}</span>
            <span className="brand-sub">{t('footerTagline')}</span>
          </span>
        </div>
        <p className="footer-meta">{t('footerCopyright', { year: localDigits(YEAR, lang) })}</p>
        <a className="btn ghost" href="#top">
          <Icon name="arrowUp" size={20} />
          {t('footerBackToTop')}
        </a>
      </div>
    </footer>
  )
}
