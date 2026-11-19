import { Inject, Injectable, Logger } from '@nestjs/common';
import { localDigits, t, type Lang, type StringKey } from '@bw/shared';
import { CLOCK, type Clock } from '../../../common/clock.js';
import { PushDevicesRepository } from '../repositories/push-devices.repository.js';
import type { PushMessage, PushSender } from '../types/push-sender.type.js';

/** Injection token for the PushSender contract (tests swap in a fake; FCM arrives in M7). */
export const PUSH_SENDER = Symbol('PUSH_SENDER');

/** What a push says; the text is `push_<kind>` in @bw/shared, in the reader's language. */
export type PushKind =
  | 'ACCEPTED'
  | 'RELEASED'
  | 'WEIGHED'
  | 'PAID'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'RESOLVED'
  | 'NEW_REQUEST'
  | 'CONFIRMED'
  | 'DISPUTED'
  | 'PAYMENT_REPORTED'
  | 'APPROVED'
  | 'REJECTED';

/** Device registration, and pushes that mirror the live events for people who are not in the app. */
@Injectable()
export class PushService {
  private readonly logger = new Logger('Push');

  constructor(
    private readonly pushDevicesRepository: PushDevicesRepository,
    @Inject(PUSH_SENDER) private readonly sender: PushSender,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  register(userId: string, token: string, platform: 'ANDROID' | 'IOS'): Promise<void> {
    return this.pushDevicesRepository.upsert(token, userId, platform, this.clock.now());
  }

  unregister(userId: string, token: string): Promise<void> {
    return this.pushDevicesRepository.deleteForUser(token, userId);
  }

  /**
   * Sends `kind` to every phone of these users, in each user's language. Best effort: it never throws and the
   * caller does not wait for it; tokens the provider rejects are removed.
   */
  notify(userIds: (string | null | undefined)[], kind: PushKind, vars: Record<string, string> = {}, data: Record<string, string> = {}): void {
    const ids = [...new Set(userIds.filter((id): id is string => !!id))];
    if (ids.length === 0) return;
    void this.deliver(ids, kind, vars, data).catch((error: unknown) => this.logger.warn(`Push ${kind} failed: ${String(error)}`));
  }

  /** The message one user's phone gets (exported for tests through the sender). */
  text(kind: PushKind, lang: Lang, vars: Record<string, string>): { title: string; body: string } {
    const filled = 'name' in vars && !vars.name ? { ...vars, name: t('collectorFallbackName', lang) } : vars;
    const local = Object.fromEntries(Object.entries(filled).map(([k, v]) => [k, localDigits(v, lang)]));
    return { title: t('push_title', lang), body: t(`push_${kind}` as StringKey, lang, local) };
  }

  private async deliver(userIds: string[], kind: PushKind, vars: Record<string, string>, data: Record<string, string>): Promise<void> {
    const targets = await this.pushDevicesRepository.targets(userIds);
    if (targets.length === 0) return;
    const messages: PushMessage[] = targets.map((d) => ({
      token: d.token,
      platform: d.platform,
      ...this.text(kind, d.language === 'EN' ? 'en' : 'bn', vars),
      data: { kind, ...data },
    }));
    const { invalidTokens } = await this.sender.send(messages);
    await this.pushDevicesRepository.deleteTokens(invalidTokens);
  }
}
