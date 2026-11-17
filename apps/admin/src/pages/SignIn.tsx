import type { components } from '@bw/shared'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { useSession } from '../auth/session-context'
import { BrandMark } from '../components/BrandMark'
import { Button } from '../components/ui'
import { errorMessage } from '../lib/errors'
import { formatPhone, normalizePhone } from '../lib/format'
import { useLang, useT } from '../lib/i18n'

type Session = components['schemas']['Session']

/** Phone and OTP sign-in for admin accounts (same OTP flow as the apps). */
export function SignIn() {
  const { t, lang } = useT()
  const { setLang } = useLang()
  const { api, signIn } = useSession()
  const [phoneText, setPhoneText] = useState('')
  const [phone, setPhone] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendCode = async (e: FormEvent) => {
    e.preventDefault()
    const normalized = normalizePhone(phoneText)
    if (!normalized) return setError(t('phoneInvalid'))
    setBusy(true)
    setError(null)
    try {
      await api.request('POST', '/auth/otp/request', { body: { phone: normalized }, auth: false })
      setPhone(normalized)
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'OTP_RATE_LIMIT' ? t('otpRateLimit') : errorMessage(err, lang))
    } finally {
      setBusy(false)
    }
  }

  const verify = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      // The role is only used for new numbers; an existing admin keeps ADMIN.
      const session = await api.request<Session>('POST', '/auth/otp/verify', { body: { phone, code, role: 'HOUSEHOLD' }, auth: false })
      await signIn(session)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'FORBIDDEN') setError(t('notAdmin'))
      else if (err instanceof ApiError && err.code === 'OTP_INVALID') setError(t('otpWrong'))
      else setError(errorMessage(err, lang))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="signin">
      <div className="panel">
        <div className="row">
          <BrandMark />
          <h1 style={{ fontSize: 24 }}>{t('signInTitle')}</h1>
        </div>
        {phone === null ? (
          <form className="stack" onSubmit={sendCode}>
            <label className="field">
              {t('phoneLabel')}
              <input type="tel" value={phoneText} onChange={(e) => setPhoneText(e.target.value)} autoComplete="tel" placeholder="01700000000" autoFocus />
            </label>
            <Button variant="primary" type="submit" busy={busy}>
              ✉ {t('sendCode')}
            </Button>
          </form>
        ) : (
          <form className="stack" onSubmit={verify}>
            <p className="muted" style={{ margin: 0 }}>{t('codeSentTo', { phone: formatPhone(phone, lang) })}</p>
            <label className="field">
              {t('codeLabel')}
              <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            </label>
            <Button variant="primary" type="submit" busy={busy} disabled={code.length !== 6}>
              → {t('verify')}
            </Button>
            <Button variant="link" onClick={() => { setPhone(null); setCode(''); setError(null) }}>
              ← {t('changeNumber')}
            </Button>
          </form>
        )}
        {error ? <p className="alert" role="alert" style={{ margin: 0 }}>{error}</p> : null}
        <Button small onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}>
          ⇄ {t('langToggle')}
        </Button>
      </div>
    </div>
  )
}
