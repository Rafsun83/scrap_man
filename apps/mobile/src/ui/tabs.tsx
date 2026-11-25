import type { BottomTabNavigationOptions } from 'expo-router/tabs';
import { Icon, type IconName } from './components';
import { body, colors, radius, tones } from './theme';

/**
 * Bottom tab bar for both roles (v1 style): white bar, the active tab on a soft ink tile with 6 px corners,
 * icon plus label, no animation.
 */
export const tabScreenOptions: BottomTabNavigationOptions = {
  headerShown: false,
  animation: 'none',
  tabBarActiveTintColor: colors.ink,
  tabBarInactiveTintColor: colors.muted,
  tabBarActiveBackgroundColor: tones.inkTint,
  tabBarLabelStyle: { ...body(12, 600) },
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopColor: colors.divider,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  tabBarItemStyle: {
    minHeight: 56,
    borderRadius: radius.md,
    marginHorizontal: 2,
    overflow: 'hidden',
  },
  sceneStyle: { backgroundColor: colors.ground },
};

/** Tab icon: ink when active, muted otherwise. */
export const tabIcon =
  (name: IconName) =>
  ({ focused }: { focused: boolean }) => (
    <Icon name={name} size={22} color={focused ? colors.ink : colors.muted} />
  );
