import { Body, Controller, HttpCode, Ip, Post } from '@nestjs/common';
import { Public } from '../../../common/auth.decorators.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import type { AuthTokensDto } from '../dtos/auth-tokens.dto.js';
import { refreshTokenDto, type RefreshTokenDto } from '../dtos/refresh-token.dto.js';
import { requestOtpDto, type RequestOtpDto } from '../dtos/request-otp.dto.js';
import { verifyOtpDto, type VerifyOtpDto } from '../dtos/verify-otp.dto.js';
import { AuthService } from '../services/auth.service.js';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/request')
  @HttpCode(204)
  async requestOtp(@Body(new ZodPipe(requestOtpDto)) body: RequestOtpDto, @Ip() ip: string): Promise<void> {
    await this.authService.requestOtp(body.phone, ip);
  }

  @Post('otp/verify')
  @HttpCode(200)
  verifyOtp(@Body(new ZodPipe(verifyOtpDto)) body: VerifyOtpDto): Promise<AuthTokensDto> {
    return this.authService.verifyOtp(body);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodPipe(refreshTokenDto)) body: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body(new ZodPipe(refreshTokenDto)) body: RefreshTokenDto): Promise<void> {
    await this.authService.logout(body.refreshToken);
  }
}
