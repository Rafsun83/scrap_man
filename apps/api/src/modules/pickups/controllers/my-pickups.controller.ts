import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth.decorators.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import type { UserEntity } from '../../users/entities/user.entity.js';
import { listMyPickupsDto, type ListMyPickupsDto } from '../dtos/list-my-pickups.dto.js';
import type { PickupPageDto, PickupSummaryDto } from '../dtos/pickup.dto.js';
import { PickupsService } from '../services/pickups.service.js';

@Controller('me')
export class MyPickupsController {
  constructor(private readonly pickupsService: PickupsService) {}

  @Get('pickups')
  @Roles('HOUSEHOLD', 'COLLECTOR')
  list(@CurrentUser() user: UserEntity, @Query(new ZodPipe(listMyPickupsDto)) query: ListMyPickupsDto): Promise<PickupPageDto> {
    return this.pickupsService.listMine(user, query);
  }

  @Get('summary')
  @Roles('HOUSEHOLD')
  summary(@CurrentUser() user: UserEntity): Promise<PickupSummaryDto> {
    return this.pickupsService.summary(user);
  }
}
