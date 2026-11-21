import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Env } from '../../config/env.js';
import { DevicesController } from './controllers/devices.controller.js';
import { PushDeviceEntity } from './entities/push-device.entity.js';
import { PushDevicesRepository } from './repositories/push-devices.repository.js';
import { ConsolePushSender } from './services/console-push-sender.service.js';
import { FcmPushSender } from './services/fcm-push-sender.service.js';
import { PUSH_SENDER, PushService } from './services/push.service.js';

/** Push notifications: device tokens and a sender behind PUSH_SENDER. PUSH_PROVIDER picks it; tests replace it. */
@Module({
  imports: [TypeOrmModule.forFeature([PushDeviceEntity])],
  controllers: [DevicesController],
  providers: [
    PushDevicesRepository,
    PushService,
    {
      provide: PUSH_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get('PUSH_PROVIDER', { infer: true }) === 'fcm'
          ? FcmPushSender.create({
              serviceAccountJson: config.get('FCM_SERVICE_ACCOUNT_JSON', { infer: true }),
              projectId: config.get('FCM_PROJECT_ID', { infer: true }),
            })
          : new ConsolePushSender(),
    },
  ],
  exports: [PushService],
})
export class PushModule {}
