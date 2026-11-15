import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './controllers/notifications.controller.js';
import { NotificationReadEntity } from './entities/notification-read.entity.js';
import { NotificationsRepository } from './repositories/notifications.repository.js';
import { NotificationsService } from './services/notifications.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationReadEntity])],
  controllers: [NotificationsController],
  providers: [NotificationsRepository, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
