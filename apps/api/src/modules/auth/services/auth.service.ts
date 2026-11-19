import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/errors.js';
import type { UserEntity } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import type { AuthTokensDto } from '../dtos/auth-tokens.dto.js';
import type { VerifyOtpDto } from '../dtos/verify-otp.dto.js';
import { OtpService } from './otp.service.js';
import { TokenService } from './token.service.js';

/** Sign-in, session refresh and sign-out, and resolving an access token to an allowed user. */
@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
  ) {}

  /** Wrong OTP codes in the last `minutes` (OTP_FAILURES ops alert). */
  recentOtpFailures(minutes: number, now?: Date): Promise<number> {
    return this.otpService.failuresInLast(minutes, now);
  }

  requestOtp(phone: string, ip: string): Promise<void> {
    return this.otpService.request(phone, ip);
  }

  /** New numbers sign up with the role sent; existing numbers keep their role. */
  async verifyOtp(input: VerifyOtpDto): Promise<AuthTokensDto> {
    await this.otpService.verify(input.phone, input.code);
    const user = await this.usersService.findOrCreate(input.phone, input.role);
    this.assertNotSuspended(user);
    return this.issue(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const userId = await this.tokenService.consumeRefresh(refreshToken);
    const user = await this.usersService.findById(userId);
    if (!user) throw AppError.unauthorized('This account no longer exists.');
    this.assertNotSuspended(user);
    return this.issue(user);
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokenService.revoke(refreshToken);
  }

  /** The user behind an access token; UNAUTHORIZED or FORBIDDEN when they may not use the API. */
  async authenticate(accessToken: string): Promise<UserEntity> {
    const payload = await this.tokenService.verifyAccess(accessToken);
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw AppError.unauthorized('This account no longer exists.');
    this.assertNotSuspended(user);
    return user;
  }

  private assertNotSuspended(user: UserEntity): void {
    if (user.status === 'SUSPENDED') {
      throw AppError.forbidden('This account is suspended. Contact BhangariWala support.');
    }
  }

  private async issue(user: UserEntity): Promise<AuthTokensDto> {
    return { ...(await this.tokenService.issue(user)), user: this.usersService.toDto(user) };
  }
}
