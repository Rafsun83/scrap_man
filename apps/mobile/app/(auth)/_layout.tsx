import { Stack } from 'expo-router';
import { colors } from '../../src/ui/theme';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: colors.ground } }} />;
}
