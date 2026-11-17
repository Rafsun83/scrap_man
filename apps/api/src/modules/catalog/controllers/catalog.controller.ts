import { Body, Controller, Get, HttpCode, Put, Query } from '@nestjs/common';
import { CurrentUser, Public, Roles } from '../../../common/auth.decorators.js';
import { ZodPipe } from '../../../common/zod.pipe.js';
import type { UserEntity } from '../../users/entities/user.entity.js';
import { adminRatesQueryDto, type AdminRatesDto, type AdminRatesQueryDto } from '../dtos/admin-rates.dto.js';
import type { CategoryDto } from '../dtos/category.dto.js';
import { publishRatesDto, type PublishRatesDto } from '../dtos/publish-rates.dto.js';
import type { TodayRatesDto } from '../dtos/today-rates.dto.js';
import { CatalogService } from '../services/catalog.service.js';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get('categories')
  categories(): Promise<CategoryDto[]> {
    return this.catalogService.activeCategories();
  }

  @Public()
  @Get('rates/today')
  todayRates(): Promise<TodayRatesDto> {
    return this.catalogService.todayRates();
  }

  @Roles('ADMIN')
  @Get('admin/rates')
  ratesForDay(@Query(new ZodPipe(adminRatesQueryDto)) query: AdminRatesQueryDto): Promise<AdminRatesDto> {
    return this.catalogService.ratesForDay(query.date);
  }

  @Roles('ADMIN')
  @Put('admin/rates')
  @HttpCode(204)
  async publish(@CurrentUser() admin: UserEntity, @Body(new ZodPipe(publishRatesDto)) body: PublishRatesDto): Promise<void> {
    await this.catalogService.publishRates(admin.id, body);
  }
}
