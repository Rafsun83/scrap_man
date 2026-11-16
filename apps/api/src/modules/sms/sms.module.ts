import { Module } from '@nestjs/common';
import { ConsoleSmsService, SMS_SENDER } from './services/sms.service.js';

/** Outgoing SMS (OTP codes, collector decisions). Tests replace SMS_SENDER with a fake. */
@Module({
  providers: [{ provide: SMS_SENDER, useClass: ConsoleSmsService }],
  exports: [SMS_SENDER],
})
export class SmsModule {}
