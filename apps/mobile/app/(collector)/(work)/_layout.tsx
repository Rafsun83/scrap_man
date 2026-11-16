import { Redirect, Tabs } from 'expo-router';
import { useCollectorProfile } from '../../../src/collector/api';
import { useT } from '../../../src/i18n/lang';
import { Icon, type IconName } from '../../../src/ui/components';
import { body, colors } from '../../../src/ui/theme';

const icon =
  (name: IconName) =>
  ({ focused }: { focused: boolean }) => <Icon name={name} size={24} color={focused ? colors.ink : colors.muted} />;

/** The approved collector's tabs: requests (C1), my pickups (C8), ledger (C9), profile (C11). */
export default function WorkTabs() {
  const { t } = useT();
  const profile = useCollectorProfile();
  if (profile.data !== undefined && profile.data?.verificationStatus !== 'APPROVED') return <Redirect href="/collector" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { ...body(13, 600) },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, minHeight: 64 },
        tabBarItemStyle: { minHeight: 56 },
        sceneStyle: { backgroundColor: colors.ground },
      }}
    >
      <Tabs.Screen name="requests" options={{ title: t('cTabRequests'), tabBarIcon: icon('map-pin') }} />
      <Tabs.Screen name="jobs" options={{ title: t('cTabJobs'), tabBarIcon: icon('truck') }} />
      <Tabs.Screen name="ledger" options={{ title: t('cTabLedger'), tabBarIcon: icon('book-open') }} />
      <Tabs.Screen name="account" options={{ title: t('tabProfile'), tabBarIcon: icon('user') }} />
    </Tabs>
  );
}

export const unstable_settings = { initialRouteName: 'requests' };
