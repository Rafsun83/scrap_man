import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { HttpSmsService } from './services/http-sms.service.js';
import { ConsoleSmsService, SMS_SENDER } from './services/sms.service.js';

/** Outgoing SMS (OTP codes, collector decisions). SMS_PROVIDER picks the sender; tests replace SMS_SENDER. */
@Module({
  providers: [
    {
      provide: SMS_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get('SMS_PROVIDER', { infer: true }) === 'http'
          ? new HttpSmsService({
              url: config.get('SMS_HTTP_URL', { infer: true })!,
              apiKey: config.get('SMS_HTTP_API_KEY', { infer: true })!,
              senderId: config.get('SMS_SENDER_ID', { infer: true }),
              timeoutMs: config.get('SMS_TIMEOUT_MS', { infer: true }),
            })
          : new ConsoleSmsService(),
    },
  ],
  exports: [SMS_SENDER],
})
export class SmsModule {}
