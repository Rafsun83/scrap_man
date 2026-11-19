import { Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth.decorators.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import type { UserEntity } from '../../users/entities/user.entity.js';
import { listNotificationsDto, type ListNotificationsDto } from '../dtos/list-notifications.dto.js';
import type { NotificationPageDto } from '../dtos/notification.dto.js';
import { NotificationsService } from '../services/notifications.service.js';

/** H13 (households) and the collector bell on C1. */
@Controller('me/notifications')
@Roles('HOUSEHOLD', 'COLLECTOR')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: UserEntity,
    @Query(new ZodPipe(listNotificationsDto)) query: ListNotificationsDto,
  ): Promise<NotificationPageDto> {
    return this.notificationsService.list(user, query.limit, query.cursor);
  }

  @Post('read')
  @HttpCode(204)
  async markAllRead(@CurrentUser() user: UserEntity): Promise<void> {
    await this.notificationsService.markAllRead(user.id);
  }
}
