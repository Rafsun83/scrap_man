import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth.decorators.js';
import { Idempotent } from '../../../common/idempotency.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import type { UserEntity } from '../../users/entities/user.entity.js';
import { arriveDto, type ArriveDto } from '../dtos/arrive.dto.js';
import { reasonDto, type ReasonDto } from '../dtos/cancel-pickup.dto.js';
import { confirmPickupDto, type ConfirmPickupDto } from '../dtos/confirm-pickup.dto.js';
import { createPickupDto, type CreatePickupDto } from '../dtos/create-pickup.dto.js';
import type { DisputeDto } from '../dtos/dispute.dto.js';
import { openDisputeDto, type OpenDisputeDto } from '../dtos/open-dispute.dto.js';
import { photoUploadDto, type PhotoUploadDto, type PhotoUploadSlotDto } from '../dtos/photo-upload.dto.js';
import { pickupIdDto } from '../dtos/pickup-id.dto.js';
import type { PickupDto } from '../dtos/pickup.dto.js';
import { ratePickupDto, type RatePickupDto } from '../dtos/rate-pickup.dto.js';
import { recordPaymentDto, type RecordPaymentDto } from '../dtos/record-payment.dto.js';
import { submitWeightsDto, type SubmitWeightsDto } from '../dtos/submit-weights.dto.js';
import { DisputesService } from '../services/disputes.service.js';
import { MatchingService } from '../services/matching.service.js';
import { PickupsService } from '../services/pickups.service.js';
import { WeighingService } from '../services/weighing.service.js';

const id = new ZodPipe(pickupIdDto);

@Controller('pickups')
export class PickupsController {
  constructor(
    private readonly pickupsService: PickupsService,
    private readonly matchingService: MatchingService,
    private readonly weighingService: WeighingService,
    private readonly disputesService: DisputesService,
  ) {}

  @Post()
  @Roles('HOUSEHOLD')
  @Idempotent()
  create(@CurrentUser() user: UserEntity, @Body(new ZodPipe(createPickupDto)) body: CreatePickupDto): Promise<PickupDto> {
    return this.pickupsService.create(user, body);
  }

  @Get(':pickupId')
  get(@CurrentUser() user: UserEntity, @Param('pickupId', id) pickupId: string): Promise<PickupDto> {
    return this.pickupsService.get(user, pickupId);
  }

  @Post(':pickupId/cancel')
  @Roles('HOUSEHOLD')
  @HttpCode(200)
  cancel(
    @CurrentUser() user: UserEntity,
    @Param('pickupId', id) pickupId: string,
    @Body(new ZodPipe(reasonDto)) body: ReasonDto,
  ): Promise<PickupDto> {
    return this.pickupsService.cancel(user, pickupId, body.reason);
  }

  @Post(':pickupId/accept')
  @Roles('COLLECTOR')
  @Idempotent()
  @HttpCode(200)
  accept(@CurrentUser() user: UserEntity, @Param('pickupId', id) pickupId: string): Promise<PickupDto> {
    return this.matchingService.accept(user, pickupId);
  }

  @Post(':pickupId/release')
  @Roles('COLLECTOR')
  @HttpCode(204)
  async release(
    @CurrentUser() user: UserEntity,
    @Param('pickupId', id) pickupId: string,
    @Body(new ZodPipe(reasonDto)) body: ReasonDto,
  ): Promise<void> {
    await this.matchingService.release(user, pickupId, body.reason);
  }

  @Post(':pickupId/arrive')
  @Roles('COLLECTOR')
  @HttpCode(200)
  arrive(
    @CurrentUser() user: UserEntity,
    @Param('pickupId', id) pickupId: string,
    @Body(new ZodPipe(arriveDto)) body: ArriveDto,
  ): Promise<PickupDto> {
    return this.weighingService.arrive(user, pickupId, body.code);
  }

  @Post(':pickupId/photos')
  photos(
    @CurrentUser() user: UserEntity,
    @Param('pickupId', id) pickupId: string,
    @Body(new ZodPipe(photoUploadDto)) body: PhotoUploadDto,
  ): Promise<PhotoUploadSlotDto> {
    return this.pickupsService.photoUploadSlot(user, pickupId, body.kind, body.contentType);
  }

  @Post(':pickupId/weights')
  @Roles('COLLECTOR', 'ADMIN')
  @Idempotent()
  @HttpCode(200)
  weights(
    @CurrentUser() user: UserEntity,
    @Param('pickupId', id) pickupId: string,
    @Body(new ZodPipe(submitWeightsDto)) body: SubmitWeightsDto,
  ): Promise<PickupDto> {
    return this.weighingService.submitWeights(user, pickupId, body);
  }

  @Post(':pickupId/confirm')
  @Roles('HOUSEHOLD')
  @Idempotent()
  @HttpCode(200)
  confirm(
    @CurrentUser() user: UserEntity,
    @Param('pickupId', id) pickupId: string,
    @Body(new ZodPipe(confirmPickupDto)) body: ConfirmPickupDto,
  ): Promise<PickupDto> {
    return this.weighingService.confirm(user, pickupId, body.paymentMethod, body.walletNumber);
  }

  @Post(':pickupId/dispute')
  @Roles('HOUSEHOLD')
  dispute(
    @CurrentUser() user: UserEntity,
    @Param('pickupId', id) pickupId: string,
    @Body(new ZodPipe(openDisputeDto)) body: OpenDisputeDto,
  ): Promise<DisputeDto> {
    return this.disputesService.open(user, pickupId, body);
  }

  @Post(':pickupId/payment')
  @Roles('COLLECTOR')
  @Idempotent()
  @HttpCode(200)
  payment(
    @CurrentUser() user: UserEntity,
    @Param('pickupId', id) pickupId: string,
    @Body(new ZodPipe(recordPaymentDto)) body: RecordPaymentDto,
  ): Promise<PickupDto> {
    return this.weighingService.recordPayment(user, pickupId, body);
  }

  @Post(':pickupId/rating')
  @Roles('HOUSEHOLD')
  @HttpCode(204)
  async rating(
    @CurrentUser() user: UserEntity,
    @Param('pickupId', id) pickupId: string,
    @Body(new ZodPipe(ratePickupDto)) body: RatePickupDto,
  ): Promise<void> {
    await this.pickupsService.rate(user, pickupId, body.stars, body.comment);
  }
}
