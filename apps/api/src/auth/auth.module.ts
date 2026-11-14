import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { OtpService } from './otp.service.js';
import { ConsoleSmsSender, SMS_SENDER } from './sms/sms-sender.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    OtpService,
    TokenService,
    { provide: SMS_SENDER, useClass: ConsoleSmsSender },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
