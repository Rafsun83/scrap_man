import type { PickupStatus } from '@bw/shared'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { errorMessage, statusTone } from '../lib/errors'
import { useT } from '../lib/i18n'
import { Icon, type IconName } from './Icon'

type Variant = 'primary' | 'dark' | 'outline' | 'danger' | 'link'

/** Every action shows an icon and text (CLAUDE.md); `icon` draws the icon before the label. */
export function Button({
  variant = 'outline',
  small,
  large,
  busy,
  icon,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean; large?: boolean; busy?: boolean; icon?: IconName }) {
  const cls = ['btn', variant === 'outline' ? '' : variant, small ? 'small' : '', large ? 'large' : ''].filter(Boolean).join(' ')
  return (
    <button type="button" {...rest} className={cls} disabled={rest.disabled || busy} aria-busy={busy || undefined}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  )
}

export function Loading() {
  const { t } = useT()
  return (
    <div className="center muted" role="status">
      {t('loading')}
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t, lang } = useT()
  return (
    <div className="center" role="alert">
      <strong className="alert">{t('errorTitle')}</strong>
      <span className="muted">{errorMessage(error, lang)}</span>
      {onRetry ? (
        <Button icon="refresh" onClick={onRetry}>
          {t('retry')}
        </Button>
      ) : null}
    </div>
  )
}

export function Empty({ text }: { text: string }) {
  return <div className="center muted">{text}</div>
}

/** A 4 px status tag. */
export function StatusBadge({ status }: { status: PickupStatus }) {
  const { t } = useT()
  return <span className={`badge ${statusTone(status)}`}>{t(`status_${status}`)}</span>
}

/** A light banner with an icon: warn (yellow), alert (red) or ok (green). */
export function Banner({ tone, children, role }: { tone: 'warn' | 'alert' | 'ok'; children: ReactNode; role?: 'status' | 'alert' }) {
  return (
    <div className={`banner ${tone}`} role={role}>
      <Icon name={tone === 'ok' ? 'checkCircle' : tone === 'alert' ? 'alertCircle' : 'info'} />
      <div>{children}</div>
    </div>
  )
}

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useT()
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row">
          <h2>{title}</h2>
          <span className="spacer" />
          <Button small icon="x" onClick={onClose}>
            {t('close')}
          </Button>
        </div>
        {children}
      </aside>
    </>
  )
}
