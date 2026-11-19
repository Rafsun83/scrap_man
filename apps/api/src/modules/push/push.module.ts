import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicesController } from './controllers/devices.controller.js';
import { PushDeviceEntity } from './entities/push-device.entity.js';
import { PushDevicesRepository } from './repositories/push-devices.repository.js';
import { ConsolePushSender } from './services/console-push-sender.service.js';
import { PUSH_SENDER, PushService } from './services/push.service.js';

/** Push notifications: device tokens and a sender behind PUSH_SENDER (console until FCM in M7). */
@Module({
  imports: [TypeOrmModule.forFeature([PushDeviceEntity])],
  controllers: [DevicesController],
  providers: [PushDevicesRepository, PushService, { provide: PUSH_SENDER, useClass: ConsolePushSender }],
  exports: [PushService],
})
export class PushModule {}
