import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { AppError } from '../../../common/errors.js';
import type { Env } from '../../../config/env.js';
import { OtpRepository } from '../repositories/otp.repository.js';
import { SMS_SENDER, type SmsSender } from '../../sms/services/sms.service.js';

export const OTP_LIMITS = {
  perPhone: 3, // OTP requests per phone in the window
  perIp: 10, // OTP requests per IP address in the window
  windowSec: 600,
  maxAttempts: 5, // wrong codes before the OTP is thrown away
} as const;

@Injectable()
export class OtpService {
  constructor(
    private readonly otpRepository: OtpRepository,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private hash(phone: string, code: string): string {
    return createHmac('sha256', this.config.get('JWT_SECRET', { infer: true }))
      .update(`${phone}:${code}`)
      .digest('hex');
  }

  /** Counts a request in a fixed window; throws OTP_RATE_LIMIT past the limit. */
  private async countRequest(key: string, limit: number): Promise<void> {
    const count = await this.otpRepository.countRequest(key, OTP_LIMITS.windowSec);
    if (count > limit) {
      const retryAfterSec = Math.max(await this.otpRepository.secondsLeft(key), 1);
      throw new AppError(
        'OTP_RATE_LIMIT',
        HttpStatus.TOO_MANY_REQUESTS,
        `Too many codes requested. Try again in ${Math.ceil(retryAfterSec / 60)} minutes.`,
        { retryAfterSec },
      );
    }
  }

  async request(phone: string, ip: string): Promise<void> {
    await this.countRequest(`bw:otp:rl:phone:${phone}`, OTP_LIMITS.perPhone);
    await this.countRequest(`bw:otp:rl:ip:${ip}`, OTP_LIMITS.perIp);

    const devCode = this.config.get('OTP_DEV_CODE', { infer: true });
    const code = devCode || String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.otpRepository.save(phone, { hash: this.hash(phone, code), attempts: 0 }, this.config.get('OTP_TTL_SEC', { infer: true }));
    await this.sms.send(phone, `ভাঙ্গারিওয়ালা কোড: ${code}। কাউকে বলবেন না। BhangariWala code: ${code}`);
  }

  /** Wrong codes entered in the last `minutes`, across all phones (ops alert). */
  failuresInLast(minutes: number, now: Date = new Date()): Promise<number> {
    return this.otpRepository.failuresSince(now, minutes);
  }

  /** Checks a code; a correct code can be used once, and 5 wrong tries discard it. */
  async verify(phone: string, code: string): Promise<void> {
    const stored = await this.otpRepository.find(phone);
    if (!stored) {
      throw new AppError('OTP_INVALID', HttpStatus.UNAUTHORIZED, 'The code has expired. Request a new one.', {
        attemptsLeft: 0,
      });
    }
    const expected = Buffer.from(stored.hash, 'hex');
    const actual = Buffer.from(this.hash(phone, code), 'hex');
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) {
      await this.otpRepository.delete(phone);
      return;
    }
    await this.otpRepository.recordFailure(new Date());
    const attempts = stored.attempts + 1;
    const attemptsLeft = OTP_LIMITS.maxAttempts - attempts;
    if (attemptsLeft <= 0) {
      await this.otpRepository.delete(phone);
    } else {
      await this.otpRepository.update(phone, { ...stored, attempts });
    }
    throw new AppError(
      'OTP_INVALID',
      HttpStatus.UNAUTHORIZED,
      attemptsLeft > 0 ? 'That code is not right. Check the SMS and try again.' : 'Too many wrong codes. Request a new one.',
      { attemptsLeft: Math.max(attemptsLeft, 0) },
    );
  }
}
