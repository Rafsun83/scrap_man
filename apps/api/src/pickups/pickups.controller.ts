import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser, Roles } from '../common/auth.decorators.js';
import { Idempotent } from '../common/idempotency.js';
import { ZodPipe } from '../common/zod.pipe.js';
import type { UserEntity } from '../users/user.entity.js';
import { DisputesService } from './disputes.service.js';
import { MatchingService } from './matching.service.js';
import { PickupsService } from './pickups.service.js';
import {
  arriveSchema,
  confirmSchema,
  createPickupSchema,
  disputeSchema,
  listMineSchema,
  paymentSchema,
  photoSchema,
  pickupIdSchema,
  ratingSchema,
  reasonSchema,
  weightsSchema,
} from './schemas.js';
import { WeighingService } from './weighing.service.js';

const id = new ZodPipe(pickupIdSchema);

@Controller('pickups')
export class PickupsController {
  constructor(
    private readonly pickups: PickupsService,
    private readonly matching: MatchingService,
    private readonly weighing: WeighingService,
    private readonly disputes: DisputesService,
  ) {}

  @Post()
  @Roles('HOUSEHOLD')
  @Idempotent()
  create(@CurrentUser() user: UserEntity, @Body(new ZodPipe(createPickupSchema)) body: z.infer<typeof createPickupSchema>) {
    return this.pickups.create(user, body);
  }

  @Get(':pickupId')
  get(@CurrentUser() user: UserEntity, @Param('pickupId', id) pickupId: string) {
    return this.pickups.get(user, pickupId);
  }

  @Post(':pickupId/cancel')
  @Roles('HOUSEHOLD')
  @HttpCode(200)
  cancel(
    @CurrentUser() user: UserEntity,
    @Param('pickupId', id) pickupId: string,
    @Body(new ZodPipe(reasonSchema)) body: z.infer<typeof reasonSchema>,
  ) {
    return this.pickups.cancel(user, pickupId, body.reason);
  }

  @Post(':pickupId/accept')
  @Roles('COLLECTOR')
  @Idempotent()
  @HttpCode(200)
  accept(@CurrentUser() user: UserEntity, @Param('pickupId', id) pickupId: string) {
    return this.matching.accept(user, pickupId);
  }

  @Post(':pickupId/release')
  @Roles('COLLECTOR')
  @HttpCode(204)
  async release(
    @CurrentUser() user: UserEntity,
    @Param('pickupId', id) pickupId: string,
    @Body(new ZodPipe(reasonSchema)) body: z.infer<typeof reasonSchema>,
  ) {
    await this.matching.release(user, pickupId, body.reason);
  }

  @Post(':pickupId/arrive')
  @Roles('COLLECTOR')
  @HttpCode(200)
  arrive(
    @CurrentUser() user: UserEntity,
    @Param('pickupId', id) pickupId: string,
    @Body(new ZodPipe(arriveSchema)) body: z.infer<typeof arriveSchema>,
  ) {
    return this.weighing.arrive(user, pickupId, body.code);
  }

  @Post(':pickupId/photos')
  photos(
    @CurrentUser() user: UserEntity,
    @Param('pickupId', id) pickupId: string,
    @Body(new ZodPipe(photoSchema)) body: z.infer<typeof photoSchema>,
  ) {
    return this.pickups.photoUploadSlot(user, pickupId, body.kind, body.contentType);
  }

  @Post(':pickupId/weights')
  @Roles('COLLECTOR', 'ADMIN')
  @Idempotent()
  @HttpCode(200)
  weights(
    @CurrentUser() user: UserEntity,
    @Param('pickupId', id) pickupId: string,
    @Body(new ZodPipe(weightsSchema)) body: z.infer<typeof weightsSchema>,
  ) {
    return this.weighing.submitWeights(user, pickupId, body);
  }

  @Post(':pickupId/confirm')
  @Roles('HOUSEHOLD')
  @Idempotent()
  @HttpCode(200)
  confirm(
    @CurrentUser() user: UserEntity,
    @Param('pickupId', id) pickupId: string,
    @Body(new ZodPipe(confirmSchema)) body: z.infer<typeof confirmSchema>,
  ) {
    return this.weighing.confirm(user, pickupId, body.paymentMethod, body.walletNumber);
  }

  @Post(':pickupId/dispute')
  @Roles('HOUSEHOLD')
  dispute(
    @CurrentUser() user: UserEntity,
    @Param('pickupId', id) pickupId: string,
    @Body(new ZodPipe(disputeSchema)) body: z.infer<typeof disputeSchema>,
  ) {
    return this.disputes.open(user, pickupId, body);
  }

  @Post(':pickupId/payment')
  @Roles('COLLECTOR')
  @Idempotent()
  @HttpCode(200)
  payment(
    @CurrentUser() user: UserEntity,
    @Param('pickupId', id) pickupId: string,
    @Body(new ZodPipe(paymentSchema)) body: z.infer<typeof paymentSchema>,
  ) {
    return this.weighing.recordPayment(user, pickupId, body);
  }

  @Post(':pickupId/rating')
  @Roles('HOUSEHOLD')
  @HttpCode(204)
  async rating(
    @CurrentUser() user: UserEntity,
    @Param('pickupId', id) pickupId: string,
    @Body(new ZodPipe(ratingSchema)) body: z.infer<typeof ratingSchema>,
  ) {
    await this.pickups.rate(user, pickupId, body.stars, body.comment);
  }
}

@Controller('me')
export class MyPickupsController {
  constructor(private readonly pickups: PickupsService) {}

  @Get('pickups')
  @Roles('HOUSEHOLD', 'COLLECTOR')
  list(@CurrentUser() user: UserEntity, @Query(new ZodPipe(listMineSchema)) query: z.infer<typeof listMineSchema>) {
    return this.pickups.listMine(user, query.status, query.limit, query.cursor);
  }

  @Get('summary')
  @Roles('HOUSEHOLD')
  summary(@CurrentUser() user: UserEntity) {
    return this.pickups.summary(user);
  }
}
