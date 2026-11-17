import { localDigits } from '@bw/shared'
import { NavLink, Outlet } from 'react-router'
import { useOverview } from '../api/hooks'
import { useSession } from '../auth/session-context'
import { useLang, useT } from '../lib/i18n'
import { useLive } from '../lib/realtime'
import { BrandMark } from './BrandMark'
import { Button } from './ui'

/** Sidebar with the five pages, live badges for pending applications and open disputes, language and sign-out. */
export function Layout() {
  const { t, lang } = useT()
  const { setLang } = useLang()
  const { user, signOut } = useSession()
  const overview = useOverview()
  const live = useLive()
  const counts = overview.data?.counts
  const badge = (n: number | undefined) => (n ? <span className="count">{localDigits(n, lang)}</span> : null)

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-name">BhangariWala</div>
            <div className="brand-sub">{t('appAdmin')}</div>
          </div>
        </div>
        <nav className="nav" aria-label={t('appAdmin')}>
          <NavLink to="/pickups">{t('navPickups')}</NavLink>
          <NavLink to="/rates">{t('navRates')}</NavLink>
          <NavLink to="/collectors">
            {t('navCollectors')}
            {badge(counts?.pendingApplications)}
          </NavLink>
          <NavLink to="/disputes">
            {t('navDisputes')}
            {badge(counts?.openDisputes)}
          </NavLink>
          <NavLink to="/users">{t('navUsers')}</NavLink>
        </nav>
        <div className="who">
          <span className="name">{user?.name ?? user?.phone}</span>
          <Button small onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}>
            ⇄ {t('langToggle')}
          </Button>
          <Button small onClick={() => void signOut()}>
            ⎋ {t('signOut')}
          </Button>
        </div>
      </aside>
      <main className="main">
        <div className="main-inner">
          {live ? null : <div className="live-note" role="status">{t('liveOff')}</div>}
          <Outlet />
        </div>
      </main>
    </div>
  )
}
