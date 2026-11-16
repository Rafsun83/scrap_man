import { Redirect, Stack } from 'expo-router';
import { useMyPickups } from '../../src/api/hooks';
import { useSession } from '../../src/auth/session';
import { useCollectorProfile } from '../../src/collector/api';
import { useLocationPings } from '../../src/collector/location';
import { colors } from '../../src/ui/theme';

export default function CollectorLayout() {
  const { user, api } = useSession();
  const isCollector = user?.role === 'COLLECTOR';
  const profile = useCollectorProfile();
  const approved = isCollector && profile.data?.verificationStatus === 'APPROVED';
  const active = useMyPickups('ACTIVE', 20, approved);
  const onTheWay = active.data?.items?.some((p) => p.status === 'ACCEPTED') ?? false;
  // Pings while online (matching) or while a household is tracking this collector.
  useLocationPings(approved && (profile.data?.isOnline === true || onTheWay), api);

  if (user && !isCollector) return <Redirect href="/home" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }} />;
}
