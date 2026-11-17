import { useSession } from '../auth/session-context'
import { SignIn } from '../pages/SignIn'
import { Layout } from './Layout'
import { Loading } from './ui'

/** Signed-out admins see the sign-in page at any address; signed-in ones the panel. */
export function Gate() {
  const { status } = useSession()
  if (status === 'loading') return <Loading />
  if (status === 'signedOut') return <SignIn />
  return <Layout />
}

