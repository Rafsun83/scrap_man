import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth.decorators.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import type { UserEntity } from '../../users/entities/user.entity.js';
import { adminCancelDto, type AdminCancelDto } from '../dtos/cancel-pickup.dto.js';
import type { DisputeDto } from '../dtos/dispute.dto.js';
import { listDisputesDto, type ListDisputesDto } from '../dtos/list-disputes.dto.js';
import { disputeIdDto, pickupIdDto } from '../dtos/pickup-id.dto.js';
import type { PickupDto } from '../dtos/pickup.dto.js';
import { resolveDisputeDto, type ResolveDisputeDto } from '../dtos/resolve-dispute.dto.js';
import { DisputesService } from '../services/disputes.service.js';
import { PickupsService } from '../services/pickups.service.js';

@Controller('admin')
@Roles('ADMIN')
export class AdminPickupsController {
  constructor(
    private readonly pickupsService: PickupsService,
    private readonly disputesService: DisputesService,
  ) {}

  @Post('pickups/:pickupId/cancel')
  @HttpCode(200)
  cancel(
    @CurrentUser() admin: UserEntity,
    @Param('pickupId', new ZodPipe(pickupIdDto)) pickupId: string,
    @Body(new ZodPipe(adminCancelDto)) body: AdminCancelDto,
  ): Promise<PickupDto> {
    return this.pickupsService.cancel(admin, pickupId, body.reason);
  }

  @Get('disputes')
  list(@Query(new ZodPipe(listDisputesDto)) query: ListDisputesDto): Promise<DisputeDto[]> {
    return this.disputesService.list(query.status);
  }

  @Post('disputes/:disputeId/resolve')
  @HttpCode(200)
  resolve(
    @CurrentUser() admin: UserEntity,
    @Param('disputeId', new ZodPipe(disputeIdDto)) disputeId: string,
    @Body(new ZodPipe(resolveDisputeDto)) body: ResolveDisputeDto,
  ): Promise<DisputeDto> {
    return this.disputesService.resolve(admin, disputeId, body.outcome, body.note);
  }
}
