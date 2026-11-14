import { Body, Controller, HttpCode, Ip, Post } from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../common/auth.decorators.js';
import { AppError } from '../common/errors.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { UsersService } from '../users/users.service.js';
import { OtpService } from './otp.service.js';
import { phoneSchema } from './phone.js';
import { TokenService } from './token.service.js';

const requestSchema = z.object({ phone: phoneSchema });
const verifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^[0-9]{6}$/, 'The code has 6 digits.'),
  role: z.enum(['HOUSEHOLD', 'COLLECTOR']),
});
const refreshSchema = z.object({ refreshToken: z.string().min(20) });

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
  ) {}

  @Post('otp/request')
  @HttpCode(204)
  async requestOtp(@Body(new ZodPipe(requestSchema)) body: z.infer<typeof requestSchema>, @Ip() ip: string) {
    await this.otp.request(body.phone, ip);
  }

  /** New numbers sign up with the role sent; existing numbers keep their role. */
  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(@Body(new ZodPipe(verifySchema)) body: z.infer<typeof verifySchema>) {
    await this.otp.verify(body.phone, body.code);
    const user = await this.users.findOrCreate(body.phone, body.role);
    if (user.status === 'SUSPENDED') {
      throw AppError.forbidden('This account is suspended. Contact BhangariWala support.');
    }
    return this.tokens.issue(user);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body(new ZodPipe(refreshSchema)) body: z.infer<typeof refreshSchema>) {
    const userId = await this.tokens.consumeRefresh(body.refreshToken);
    const user = await this.users.findById(userId);
    if (!user) throw AppError.unauthorized('This account no longer exists.');
    if (user.status === 'SUSPENDED') {
      throw AppError.forbidden('This account is suspended. Contact BhangariWala support.');
    }
    return this.tokens.issue(user);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body(new ZodPipe(refreshSchema)) body: z.infer<typeof refreshSchema>) {
    await this.tokens.revoke(body.refreshToken);
  }
}
