import type { components } from '@bw/shared'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, createApiClient } from '../api/client'
import { SessionContext, type SessionValue } from './session-context'
import { createTokenHolder } from './tokens'

type Session = components['schemas']['Session']
type User = components['schemas']['User']

/** The admin's session: sign-in, a silent sign-in after a reload, refresh on 401, and sign-out. */
export function SessionProvider({ children, baseUrl = '/api/v1' }: { children: ReactNode; baseUrl?: string }) {
  const [tokens] = useState(createTokenHolder)
  const [status, setStatus] = useState<SessionValue['status']>(() => (tokens.refresh ? 'loading' : 'signedOut'))
  const [user, setUser] = useState<User | null>(null)

  const apply = useCallback(
    (s: Session | null) => {
      tokens.set(s?.accessToken ?? null, s?.refreshToken ?? null)
      setUser(s?.user ?? null)
      setStatus(s ? 'signedIn' : 'signedOut')
    },
    [tokens],
  )

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl,
        getAccessToken: () => tokens.access,
        getRefreshToken: () => tokens.refresh,
        onSession: (s) => apply(s.user?.role === 'ADMIN' ? s : null),
        onSignedOut: () => apply(null),
      }),
    [baseUrl, apply, tokens],
  )

  // A saved refresh token signs back in after a reload.
  useEffect(() => {
    if (!tokens.refresh) return
    void api.refresh().then((ok) => {
      if (!ok) apply(null)
    })
  }, [api, apply, tokens])

  const signIn = useCallback(
    async (s: Session) => {
      if (s.user?.role !== 'ADMIN') {
        if (s.refreshToken) await api.request('POST', '/auth/logout', { body: { refreshToken: s.refreshToken }, auth: false }).catch(() => {})
        throw new ApiError('FORBIDDEN', 'This number is not an admin account.', 403)
      }
      apply(s)
    },
    [api, apply],
  )

  const signOut = useCallback(async () => {
    const refresh = tokens.refresh
    apply(null)
    if (refresh) await api.request('POST', '/auth/logout', { body: { refreshToken: refresh }, auth: false }).catch(() => {})
  }, [api, apply, tokens])

  const value = useMemo<SessionValue>(
    () => ({ status, user, api, accessToken: () => tokens.access, signIn, signOut }),
    [status, user, api, signIn, signOut, tokens],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
