import { Logger } from '@nestjs/common';
import { applicationDefault, cert, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging, type Message, type Messaging } from 'firebase-admin/messaging';
import type { PushMessage, PushSender } from '../types/push-sender.type.js';

/** The Android notification channel the app creates on start (apps/mobile/src/push/registration.ts). */
export const ANDROID_CHANNEL_ID = 'default';

/** FCM takes at most 500 messages per sendEach call. */
const BATCH_SIZE = 500;

/** FCM error codes that mean the token will never work again, so the device row can go. */
const DEAD_TOKEN_CODES = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);

export interface FcmSettings {
  /** The service-account key as JSON text; without it the Google default credentials are used. */
  serviceAccountJson?: string;
  projectId?: string;
}

/**
 * Sends pushes through Firebase Cloud Messaging. Android only for now: the app registers the phone's FCM token there,
 * while an iPhone gives an APNs token that FCM cannot address, so iOS messages are skipped (not deleted).
 */
export class FcmPushSender implements PushSender {
  private readonly logger = new Logger('Push');

  constructor(private readonly messaging: Pick<Messaging, 'sendEach'>) {}

  /** Signs in to Firebase with the key, or with GOOGLE_APPLICATION_CREDENTIALS / keyless default credentials. */
  static create(settings: FcmSettings): FcmPushSender {
    let credential;
    try {
      credential = settings.serviceAccountJson ? cert(JSON.parse(settings.serviceAccountJson) as ServiceAccount) : applicationDefault();
    } catch (error) {
      const source = settings.serviceAccountJson ? 'FCM_SERVICE_ACCOUNT_JSON' : 'GOOGLE_APPLICATION_CREDENTIALS';
      throw new Error(`Firebase refused the key in ${source}: ${(error as Error).message} Download a new key from Firebase.`);
    }
    const app = initializeApp({ credential, ...(settings.projectId ? { projectId: settings.projectId } : {}) }, 'bw-push');
    return new FcmPushSender(getMessaging(app));
  }

  async send(messages: PushMessage[]): Promise<{ invalidTokens: string[] }> {
    const android = messages.filter((m) => m.platform === 'ANDROID');
    const skipped = messages.length - android.length;
    if (skipped > 0) this.logger.debug({ msg: 'push skipped', reason: 'iOS not supported yet', count: skipped });

    const invalidTokens: string[] = [];
    for (let i = 0; i < android.length; i += BATCH_SIZE) {
      const batch = android.slice(i, i + BATCH_SIZE);
      try {
        const res = await this.messaging.sendEach(batch.map(toFcm));
        res.responses.forEach((r, j) => {
          if (r.success) return;
          const code = r.error?.code ?? 'unknown';
          if (DEAD_TOKEN_CODES.has(code)) invalidTokens.push(batch[j]!.token);
          else this.logger.warn({ msg: 'push not sent', token: mask(batch[j]!.token), code });
        });
        this.logger.log({ msg: 'push sent', sent: res.successCount, failed: res.failureCount });
      } catch (error) {
        // Firebase unreachable or the credentials refused: these pushes are lost, the next ones try again.
        this.logger.warn({ msg: 'push batch failed', count: batch.length, error: String(error) });
      }
    }
    return { invalidTokens };
  }
}

function toFcm(m: PushMessage): Message {
  return {
    token: m.token,
    notification: { title: m.title, body: m.body },
    data: m.data,
    android: { priority: 'high', notification: { channelId: ANDROID_CHANNEL_ID, sound: 'default' } },
  };
}

const mask = (token: string): string => `${token.slice(0, 8)}…`;
