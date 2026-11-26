import { localDigits } from '@bw/shared'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useOverview } from '../api/hooks'
import { useSession } from '../auth/session-context'
import { formatPhone, initials } from '../lib/format'
import { useT } from '../lib/i18n'
import { useLive } from '../lib/realtime'
import { BrandMark } from './BrandMark'
import { Icon, type IconName } from './Icon'
import { Button } from './ui'

/**
 * White side menu with the five pages (icon and label; live counts for pending applications and open disputes),
 * the signed-in admin and sign-out. Each page header ends with the language button (PageHead).
 */
export function Layout() {
  const { t, lang } = useT()
  const { user, signOut } = useSession()
  const { pathname } = useLocation()
  const overview = useOverview()
  const live = useLive()
  const counts = overview.data?.counts
  const link = (to: string, icon: IconName, label: string, count?: number, tone?: 'alert') => (
    <NavLink to={to}>
      <Icon name={icon} />
      <span className="label">{label}</span>
      {count ? <span className={`count ${tone ?? ''}`}>{localDigits(count, lang)}</span> : null}
    </NavLink>
  )

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          <div>
            <span className="brand-name">BhangariWala</span>
            <span className="brand-sub">{t('appAdmin')}</span>
          </div>
        </div>
        <nav className="nav" aria-label={t('appAdmin')}>
          {link('/pickups', 'pin', t('navPickups'))}
          {link('/rates', 'chart', t('navRates'))}
          {link('/collectors', 'userCheck', t('navCollectors'), counts?.pendingApplications)}
          {link('/disputes', 'alertCircle', t('navDisputes'), counts?.openDisputes, 'alert')}
          {link('/users', 'users', t('navUsers'))}
        </nav>
        <div className="who">
          <div className="who-id">
            <span className="avatar" aria-hidden="true">{initials(user?.name, user?.phone)}</span>
            <div style={{ minWidth: 0 }}>
              <div className="name">{user?.name ?? formatPhone(user?.phone ?? null, lang)}</div>
              <div className="role">{t('appAdmin')}</div>
            </div>
          </div>
          <Button small icon="logout" onClick={() => void signOut()}>
            {t('signOut')}
          </Button>
        </div>
      </aside>
      <main className="main">
        <div className={`main-inner ${pathname.startsWith('/rates') ? 'narrow' : ''}`}>
          {live ? null : (
            <div className="live-note" role="status">
              <Icon name="info" />
              {t('liveOff')}
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  )
}
