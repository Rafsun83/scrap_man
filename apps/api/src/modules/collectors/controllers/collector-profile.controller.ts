import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth.decorators.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import type { UserEntity } from '../../users/entities/user.entity.js';
import type { CollectorProfileDto } from '../dtos/collector-profile.dto.js';
import { collectorSignupDto, type CollectorSignupDto } from '../dtos/collector-signup.dto.js';
import { selfieUploadDto, type SelfieUploadDto, type UploadSlotDto } from '../dtos/selfie-upload.dto.js';
import { updateCollectorProfileDto, type UpdateCollectorProfileDto } from '../dtos/update-collector-profile.dto.js';
import { CollectorsService } from '../services/collectors.service.js';

@Controller('collector')
@Roles('COLLECTOR')
export class CollectorProfileController {
  constructor(private readonly collectorsService: CollectorsService) {}

  @Post('selfie')
  selfie(@CurrentUser() user: UserEntity, @Body(new ZodPipe(selfieUploadDto)) body: SelfieUploadDto): Promise<UploadSlotDto> {
    return this.collectorsService.selfieUploadSlot(user.id, body.contentType);
  }

  @Post('signup')
  signUp(@CurrentUser() user: UserEntity, @Body(new ZodPipe(collectorSignupDto)) body: CollectorSignupDto): Promise<CollectorProfileDto> {
    return this.collectorsService.signUp(user.id, body);
  }

  @Get('profile')
  profile(@CurrentUser() user: UserEntity): Promise<CollectorProfileDto> {
    return this.collectorsService.profile(user.id);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: UserEntity,
    @Body(new ZodPipe(updateCollectorProfileDto)) body: UpdateCollectorProfileDto,
  ): Promise<CollectorProfileDto> {
    return this.collectorsService.updateProfile(user.id, body);
  }
}
