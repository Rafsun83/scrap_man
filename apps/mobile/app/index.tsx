import { Redirect } from 'expo-router';
import { useSession } from '../src/auth/session';

/** Entry: send each person to their side of the app. */
export default function Index() {
  const { status, user } = useSession();
  if (status !== 'signedIn') return <Redirect href="/sign-in" />;
  if (user?.role === 'HOUSEHOLD') return <Redirect href="/home" />;
  return <Redirect href="/collector" />;
}
