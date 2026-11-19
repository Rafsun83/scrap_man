import { Logger } from '@nestjs/common';
import type { SmsSender } from './sms.service.js';

export interface HttpSmsSettings {
  url: string;
  apiKey: string;
  senderId?: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

/** "+8801712345678" -> "+88017XXXXX678" for logs. */
export function maskPhone(phone: string): string {
  return phone.length > 8 ? `${phone.slice(0, 6)}${'X'.repeat(phone.length - 9)}${phone.slice(-3)}` : 'XXXX';
}

/**
 * Sends SMS through a gateway that accepts `POST { to, message, senderId }` with a bearer key. Times out after
 * `timeoutMs` and retries once on a network error or a 5xx; a 4xx is not retried. The provider-specific adapter
 * (if the chosen gateway speaks another format) arrives in M7.
 */
export class HttpSmsService implements SmsSender {
  private readonly logger = new Logger('SMS');
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly settings: HttpSmsSettings) {
    this.fetchImpl = settings.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  }

  async send(phone: string, message: string): Promise<void> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const outcome = await this.attempt(phone, message);
      if (outcome === 'sent') return;
      if (outcome === 'refused' || attempt === 2) {
        throw new Error(`SMS to ${maskPhone(phone)} failed (${outcome}).`);
      }
      this.logger.warn({ msg: 'sms retry', to: maskPhone(phone) });
    }
  }

  private async attempt(phone: string, message: string): Promise<'sent' | 'refused' | 'unavailable'> {
    try {
      const res = await this.fetchImpl(this.settings.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.settings.apiKey}` },
        body: JSON.stringify({ to: phone, message, ...(this.settings.senderId ? { senderId: this.settings.senderId } : {}) }),
        signal: AbortSignal.timeout(this.settings.timeoutMs),
      });
      if (res.ok) {
        this.logger.log({ msg: 'sms sent', to: maskPhone(phone) });
        return 'sent';
      }
      this.logger.warn({ msg: 'sms not sent', to: maskPhone(phone), status: res.status });
      return res.status >= 500 ? 'unavailable' : 'refused';
    } catch (error) {
      this.logger.warn({ msg: 'sms not sent', to: maskPhone(phone), error: String(error) });
      return 'unavailable';
    }
  }
}
