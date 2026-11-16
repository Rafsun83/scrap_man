import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth.decorators.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import type { UserEntity } from '../../users/entities/user.entity.js';
import {
  collectorDecisionDto,
  collectorUserIdDto,
  listCollectorsDto,
  type CollectorDecisionDto,
  type CollectorUserIdDto,
  type ListCollectorsDto,
} from '../dtos/collector-decision.dto.js';
import type { CollectorProfilePageDto } from '../dtos/collector-profile.dto.js';
import { CollectorApprovalsService } from '../services/collector-approvals.service.js';

@Controller('admin/collectors')
@Roles('ADMIN')
export class AdminCollectorsController {
  constructor(private readonly collectorApprovalsService: CollectorApprovalsService) {}

  @Get()
  list(@Query(new ZodPipe(listCollectorsDto)) query: ListCollectorsDto): Promise<CollectorProfilePageDto> {
    return this.collectorApprovalsService.list(query);
  }

  @Post(':userId/decision')
  @HttpCode(204)
  async decide(
    @CurrentUser() admin: UserEntity,
    @Param(new ZodPipe(collectorUserIdDto)) params: CollectorUserIdDto,
    @Body(new ZodPipe(collectorDecisionDto)) body: CollectorDecisionDto,
  ): Promise<void> {
    await this.collectorApprovalsService.decide(admin.id, params.userId, body);
  }
}
