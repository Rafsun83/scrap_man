import { Tabs, useRouter } from 'expo-router';
import { useT } from '../../../src/i18n/lang';
import { tabIcon as icon, tabScreenOptions } from '../../../src/ui/tabs';

export default function HouseholdTabs() {
  const { t } = useT();
  const router = useRouter();
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="home" options={{ title: t('tabHome'), tabBarIcon: icon('home') }} />
      <Tabs.Screen
        name="sell"
        options={{ title: t('tabSell'), tabBarIcon: icon('tag') }}
        listeners={{
          // "Sell" opens the two-step request flow on top of the tabs.
          tabPress: (e) => {
            e.preventDefault();
            router.push('/sell/items');
          },
        }}
      />
      <Tabs.Screen name="history" options={{ title: t('tabHistory'), tabBarIcon: icon('clock') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabProfile'), tabBarIcon: icon('user') }} />
    </Tabs>
  );
}

export const unstable_settings = { initialRouteName: 'home' };
