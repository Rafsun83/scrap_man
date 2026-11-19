import type { DevicePlatform } from '@bw/shared';

/** One push to one phone. `data` lets the app open the right screen when tapped. */
export interface PushMessage {
  token: string;
  platform: DevicePlatform;
  title: string;
  body: string;
  data: Record<string, string>;
}

/** Sends pushes through a provider (FCM in M7). Returns the tokens the provider says are no longer valid. */
export interface PushSender {
  send(messages: PushMessage[]): Promise<{ invalidTokens: string[] }>;
}
