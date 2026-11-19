import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { ApiClient } from '../api/client';
import { pushRoute } from './route';

/** True once a Firebase config is in the build (GOOGLE_SERVICES_JSON, M7); until then nothing here runs. */
export const pushEnabled = Constants.expoConfig?.extra?.pushEnabled === true;

const TOKEN_KEY = 'bw.push.token';

type NotificationsModule = typeof import('expo-notifications');

/** Loaded only when push is enabled, so builds and tests without Firebase never touch the native module. */
function notifications(): NotificationsModule {
  return require('expo-notifications') as NotificationsModule;
}

/**
 * While signed in as a household or collector: asks permission, registers the phone's token with the API
 * (PUT /me/devices), shows pushes as banners, and opens the right screen when one is tapped.
 */
export function usePushRegistration(signedIn: boolean, role: string | undefined, api: ApiClient) {
  const router = useRouter();
  useEffect(() => {
    if (!pushEnabled || !signedIn || role === 'ADMIN') return;
    const N = notifications();
    N.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    let cancelled = false;
    void (async () => {
      const perm = await N.requestPermissionsAsync();
      if (!perm.granted || cancelled) return;
      const { data: token } = await N.getDevicePushTokenAsync();
      if (typeof token !== 'string' || cancelled) return;
      await api.request('PUT', '/me/devices', { body: { token, platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID' } });
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    })().catch(() => {
      // No permission or no network: the app still works with live updates; try again next launch.
    });
    const open = (data: Record<string, unknown> | undefined) => router.push(pushRoute(data, role) as never);
    const last = N.getLastNotificationResponse();
    if (last) open(last.notification.request.content.data);
    const sub = N.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [signedIn, role, api, router]);
}

/** On sign-out: stop pushes to this phone (DELETE /me/devices/{token}) while the session still works. */
export async function forgetPushToken(api: ApiClient): Promise<void> {
  if (!pushEnabled) return;
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  if (!token) return;
  await api.request('DELETE', `/me/devices/${encodeURIComponent(token)}`).catch(() => {});
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
}
