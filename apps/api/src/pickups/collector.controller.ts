import { Body, Controller, Get, HttpCode, Put, Query } from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser, Roles } from '../common/auth.decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import type { UserEntity } from '../users/user.entity.js';
import { CollectorService } from './collector.service.js';
import { MatchingService } from './matching.service.js';
import { collectorStatusSchema, locationSchema, nearbySchema } from './schemas.js';

@Controller('collector')
@Roles('COLLECTOR')
export class CollectorController {
  constructor(
    private readonly collectors: CollectorService,
    private readonly matching: MatchingService,
  ) {}

  @Put('status')
  @HttpCode(204)
  async status(
    @CurrentUser() user: UserEntity,
    @Body(new ZodPipe(collectorStatusSchema)) body: z.infer<typeof collectorStatusSchema>,
  ) {
    await this.collectors.setStatus(user, body.online, body.location);
  }

  @Put('location')
  @HttpCode(204)
  async location(@CurrentUser() user: UserEntity, @Body(new ZodPipe(locationSchema)) body: z.infer<typeof locationSchema>) {
    await this.collectors.ping(user, body);
  }

  @Get('requests/nearby')
  nearby(@CurrentUser() user: UserEntity, @Query(new ZodPipe(nearbySchema)) query: z.infer<typeof nearbySchema>) {
    return this.matching.nearby(user, query.lat, query.lng);
  }
}
