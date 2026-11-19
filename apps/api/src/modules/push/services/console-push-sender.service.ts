import { Logger } from '@nestjs/common';
import type { PushMessage, PushSender } from '../types/push-sender.type.js';

/** Development and until FCM is set up (M7): logs each push instead of sending it. */
export class ConsolePushSender implements PushSender {
  private readonly logger = new Logger('Push');

  async send(messages: PushMessage[]): Promise<{ invalidTokens: string[] }> {
    for (const m of messages) {
      this.logger.log({ msg: 'push', token: `${m.token.slice(0, 8)}…`, platform: m.platform, body: m.body, data: m.data });
    }
    return { invalidTokens: [] };
  }
}
