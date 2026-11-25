import { Redirect, Tabs } from 'expo-router';
import { useCollectorProfile } from '../../../src/collector/api';
import { useT } from '../../../src/i18n/lang';
import { tabIcon as icon, tabScreenOptions } from '../../../src/ui/tabs';

/** The approved collector's tabs: requests (C1), my pickups (C8), ledger (C9), profile (C11). */
export default function WorkTabs() {
  const { t } = useT();
  const profile = useCollectorProfile();
  if (profile.data !== undefined && profile.data?.verificationStatus !== 'APPROVED') return <Redirect href="/collector" />;
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="requests" options={{ title: t('cTabRequests'), tabBarIcon: icon('map-pin') }} />
      <Tabs.Screen name="jobs" options={{ title: t('cTabJobs'), tabBarIcon: icon('truck') }} />
      <Tabs.Screen name="ledger" options={{ title: t('cTabLedger'), tabBarIcon: icon('book-open') }} />
      <Tabs.Screen name="account" options={{ title: t('tabProfile'), tabBarIcon: icon('user') }} />
    </Tabs>
  );
}

export const unstable_settings = { initialRouteName: 'requests' };
