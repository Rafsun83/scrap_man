import { Body, Controller, Get, HttpCode, Put } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, Public, Roles } from '../common/auth.decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import type { UserEntity } from '../users/user.entity.js';
import { CatalogService } from './catalog.service.js';
import { toCategoryDto } from './category.entity.js';

const publishSchema = z.object({
  effectiveDate: z.iso.date(),
  rates: z
    .array(
      z.object({
        categoryCode: z.string().min(1).max(30),
        ratePerKg: z.number().positive().max(100_000).multipleOf(0.01),
      }),
    )
    .min(1),
});

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get('categories')
  async categories() {
    return (await this.catalog.activeCategories()).map(toCategoryDto);
  }

  @Public()
  @Get('rates/today')
  todayRates() {
    return this.catalog.todayRates();
  }

  @Roles('ADMIN')
  @Put('admin/rates')
  @HttpCode(204)
  async publish(
    @CurrentUser() admin: UserEntity,
    @Body(new ZodPipe(publishSchema)) body: z.infer<typeof publishSchema>,
  ) {
    await this.catalog.publishRates(admin.id, body.effectiveDate, body.rates);
  }
}
