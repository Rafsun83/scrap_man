import { Injectable, Logger } from '@nestjs/common';

export const SMS_SENDER = Symbol('SMS_SENDER');

/** Sends a text message. Swap the console version for a Bangladeshi SMS gateway before launch. */
export interface SmsSender {
  send(phone: string, message: string): Promise<void>;
}

@Injectable()
export class ConsoleSmsSender implements SmsSender {
  private readonly logger = new Logger('SMS');

  async send(phone: string, message: string): Promise<void> {
    this.logger.log(`to ${phone}: ${message}`);
  }
}
