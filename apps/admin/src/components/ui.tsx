import type { PickupStatus } from '@bw/shared'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { errorMessage, statusTone } from '../lib/errors'
import { useT } from '../lib/i18n'

type Variant = 'primary' | 'dark' | 'outline' | 'danger' | 'link'

export function Button({ variant = 'outline', small, busy, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean; busy?: boolean }) {
  const cls = ['btn', variant === 'outline' ? '' : variant, small ? 'small' : ''].filter(Boolean).join(' ')
  return (
    <button type="button" {...rest} className={cls} disabled={rest.disabled || busy} aria-busy={busy || undefined}>
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
        <Button onClick={onRetry}>
          ↻ {t('retry')}
        </Button>
      ) : null}
    </div>
  )
}

export function Empty({ text }: { text: string }) {
  return <div className="center muted">{text}</div>
}

export function StatusBadge({ status }: { status: PickupStatus }) {
  const { t } = useT()
  return <span className={`badge ${statusTone(status)}`}>{t(`status_${status}`)}</span>
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
          <Button small onClick={onClose}>
            ✕ {t('close')}
          </Button>
        </div>
        {children}
      </aside>
    </>
  )
}
