import { Body, Controller, Delete, HttpCode, Param, Put } from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth.decorators.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import type { UserEntity } from '../../users/entities/user.entity.js';
import { deviceDto, deviceTokenDto, type DeviceDto, type DeviceTokenDto } from '../dtos/device.dto.js';
import { PushService } from '../services/push.service.js';

@Controller('me/devices')
@Roles('HOUSEHOLD', 'COLLECTOR')
export class DevicesController {
  constructor(private readonly pushService: PushService) {}

  @Put()
  @HttpCode(204)
  async register(@CurrentUser() user: UserEntity, @Body(new ZodPipe(deviceDto)) body: DeviceDto): Promise<void> {
    await this.pushService.register(user.id, body.token, body.platform);
  }

  @Delete(':token')
  @HttpCode(204)
  async unregister(@CurrentUser() user: UserEntity, @Param(new ZodPipe(deviceTokenDto)) params: DeviceTokenDto): Promise<void> {
    await this.pushService.unregister(user.id, params.token);
  }
}
