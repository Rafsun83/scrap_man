import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../src/auth/session';
import { SellDraftProvider } from '../../src/household/sellDraft';
import { colors } from '../../src/ui/theme';

export default function HouseholdLayout() {
  const { user } = useSession();
  if (user && user.role !== 'HOUSEHOLD') return <Redirect href="/collector" />;
  return (
    <SellDraftProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }} />
    </SellDraftProvider>
  );
}
