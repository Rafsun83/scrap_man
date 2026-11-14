import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../src/auth/session';
import { colors } from '../../src/ui/theme';

export default function CollectorLayout() {
  const { user } = useSession();
  if (user?.role === 'HOUSEHOLD') return <Redirect href="/home" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }} />;
}
