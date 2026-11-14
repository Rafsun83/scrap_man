import { Tabs, useRouter } from 'expo-router';
import { useT } from '../../../src/i18n/lang';
import { Icon, type IconName } from '../../../src/ui/components';
import { body, colors } from '../../../src/ui/theme';

const icon =
  (name: IconName) =>
  ({ focused }: { focused: boolean }) => <Icon name={name} size={24} color={focused ? colors.ink : colors.muted} />;

export default function HouseholdTabs() {
  const { t } = useT();
  const router = useRouter();
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
        tabBarActiveBackgroundColor: colors.surface,
      }}
    >
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
