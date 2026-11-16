import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../../config/env.js';
import { SmsModule } from '../sms/sms.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './controllers/auth.controller.js';
import { AuthGuard } from './guards/auth.guard.js';
import { OtpRepository } from './repositories/otp.repository.js';
import { RefreshTokenRepository } from './repositories/refresh-token.repository.js';
import { AuthService } from './services/auth.service.js';
import { OtpService } from './services/otp.service.js';
import { TokenService } from './services/token.service.js';

@Module({
  imports: [
    UsersModule,
    SmsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    OtpRepository,
    RefreshTokenRepository,
    OtpService,
    TokenService,
    AuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
