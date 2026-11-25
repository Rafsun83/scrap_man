// Per-weight imports: the package index would bundle every weight of both fonts.
import { AnekBangla_700Bold } from '@expo-google-fonts/anek-bangla/700Bold';
import { AnekBangla_800ExtraBold } from '@expo-google-fonts/anek-bangla/800ExtraBold';
import { HindSiliguri_400Regular } from '@expo-google-fonts/hind-siliguri/400Regular';
import { HindSiliguri_500Medium } from '@expo-google-fonts/hind-siliguri/500Medium';
import { HindSiliguri_600SemiBold } from '@expo-google-fonts/hind-siliguri/600SemiBold';
import { HindSiliguri_700Bold } from '@expo-google-fonts/hind-siliguri/700Bold';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError } from '../src/api/client';
import { SessionProvider, useSession } from '../src/auth/session';
import { LangProvider } from '../src/i18n/lang';
import { usePushRegistration } from '../src/push/registration';
import { RealtimeProvider } from '../src/realtime/socket';
import { colors } from '../src/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        // Retry network blips, never client errors like NOT_FOUND.
        retry: (count, error) => count < 2 && (!(error instanceof ApiError) || error.code === 'NETWORK' || error.status >= 500),
      },
      mutations: { retry: false },
    },
  });
}

function Gate() {
  const { status, user, api } = useSession();
  usePushRegistration(status === 'signedIn', user?.role, api);
  const [fontsLoaded] = useFonts({
    AnekBangla_700Bold,
    AnekBangla_800ExtraBold,
    HindSiliguri_400Regular,
    HindSiliguri_500Medium,
    HindSiliguri_600SemiBold,
    HindSiliguri_700Bold,
  });
  const ready = fontsLoaded && status !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: colors.ground } }}>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="(household)" />
        <Stack.Screen name="(collector)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(makeQueryClient);
  return (
    <SafeAreaProvider>
      <LangProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <RealtimeProvider>
              <StatusBar style="dark" />
              <Gate />
            </RealtimeProvider>
          </SessionProvider>
        </QueryClientProvider>
      </LangProvider>
    </SafeAreaProvider>
  );
}
