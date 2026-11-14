import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, Roles } from '../common/auth.decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import type { UserEntity } from '../users/user.entity.js';
import { DisputesService } from './disputes.service.js';
import { PickupsService } from './pickups.service.js';
import { adminCancelSchema, disputeListSchema, pickupIdSchema, resolveSchema } from './schemas.js';

@Controller('admin')
@Roles('ADMIN')
export class AdminPickupsController {
  constructor(
    private readonly pickups: PickupsService,
    private readonly disputes: DisputesService,
  ) {}

  @Post('pickups/:pickupId/cancel')
  @HttpCode(200)
  cancel(
    @CurrentUser() admin: UserEntity,
    @Param('pickupId', new ZodPipe(pickupIdSchema)) pickupId: string,
    @Body(new ZodPipe(adminCancelSchema)) body: z.infer<typeof adminCancelSchema>,
  ) {
    return this.pickups.cancel(admin, pickupId, body.reason);
  }

  @Get('disputes')
  list(@Query(new ZodPipe(disputeListSchema)) query: z.infer<typeof disputeListSchema>) {
    return this.disputes.list(query.status);
  }

  @Post('disputes/:disputeId/resolve')
  @HttpCode(200)
  resolve(
    @CurrentUser() admin: UserEntity,
    @Param('disputeId', new ZodPipe(z.uuid())) disputeId: string,
    @Body(new ZodPipe(resolveSchema)) body: z.infer<typeof resolveSchema>,
  ) {
    return this.disputes.resolve(admin, disputeId, body.outcome, body.note);
  }
}
