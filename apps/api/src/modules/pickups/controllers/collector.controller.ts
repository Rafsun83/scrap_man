import { Body, Controller, Get, HttpCode, Put, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth.decorators.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import type { UserEntity } from '../../users/entities/user.entity.js';
import {
  collectorLocationDto,
  collectorStatusDto,
  nearbyQueryDto,
  type CollectorLocationDto,
  type CollectorStatusDto,
  type NearbyQueryDto,
} from '../dtos/collector-status.dto.js';
import { ledgerQueryDto, type LedgerDto, type LedgerQueryDto } from '../dtos/ledger.dto.js';
import type { NearbyRequestDto } from '../dtos/pickup.dto.js';
import { CollectorLedgerService } from '../services/collector-ledger.service.js';
import { CollectorService } from '../services/collector.service.js';
import { MatchingService } from '../services/matching.service.js';

@Controller('collector')
@Roles('COLLECTOR')
export class CollectorController {
  constructor(
    private readonly collectorService: CollectorService,
    private readonly matchingService: MatchingService,
    private readonly collectorLedgerService: CollectorLedgerService,
  ) {}

  @Put('status')
  @HttpCode(204)
  async status(@CurrentUser() user: UserEntity, @Body(new ZodPipe(collectorStatusDto)) body: CollectorStatusDto): Promise<void> {
    await this.collectorService.setStatus(user, body.online, body.location);
  }

  @Put('location')
  @HttpCode(204)
  async location(@CurrentUser() user: UserEntity, @Body(new ZodPipe(collectorLocationDto)) body: CollectorLocationDto): Promise<void> {
    await this.collectorService.ping(user, body);
  }

  @Get('requests/nearby')
  nearby(@CurrentUser() user: UserEntity, @Query(new ZodPipe(nearbyQueryDto)) query: NearbyQueryDto): Promise<NearbyRequestDto[]> {
    return this.matchingService.nearby(user, query.lat, query.lng);
  }

  @Get('ledger')
  ledger(@CurrentUser() user: UserEntity, @Query(new ZodPipe(ledgerQueryDto)) query: LedgerQueryDto): Promise<LedgerDto> {
    return this.collectorLedgerService.ledger(user.id, query);
  }
}
