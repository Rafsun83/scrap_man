import type { components } from '@bw/shared'
import { createContext, useContext } from 'react'
import type { ApiClient } from '../api/client'

type Session = components['schemas']['Session']
type User = components['schemas']['User']

export type SessionValue = {
  status: 'loading' | 'signedOut' | 'signedIn'
  user: User | null
  api: ApiClient
  accessToken: () => string | null
  /** Signs in with a session from OTP verify; refuses accounts that are not ADMIN. */
  signIn: (session: Session) => Promise<void>
  signOut: () => Promise<void>
}

export const SessionContext = createContext<SessionValue | null>(null)

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}
