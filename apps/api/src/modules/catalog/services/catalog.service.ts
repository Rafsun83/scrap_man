import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/errors.js';
import { dhakaToday } from '../../../common/time.js';
import type { AdminRatesDto } from '../dtos/admin-rates.dto.js';
import type { CategoryDto } from '../dtos/category.dto.js';
import type { PublishRatesDto } from '../dtos/publish-rates.dto.js';
import type { TodayRatesDto } from '../dtos/today-rates.dto.js';
import type { CategoryEntity } from '../entities/category.entity.js';
import { CatalogRepository } from '../repositories/catalog.repository.js';
import { todayRatesUtil } from '../utils/today-rates.util.js';

@Injectable()
export class CatalogService {
  constructor(private readonly catalogRepository: CatalogRepository) {}

  async activeCategories(): Promise<CategoryDto[]> {
    return (await this.catalogRepository.activeCategories()).map((c) => this.toCategoryDto(c));
  }

  /** The latest published rate per category up to today, and the rate before it. */
  async todayRates(): Promise<TodayRatesDto> {
    const today = dhakaToday();
    return todayRatesUtil.build(await this.catalogRepository.ratesOn(today), today);
  }

  /** A2: each category's rate for exactly this day (null until published) and the latest one before it. */
  async ratesForDay(day: string = dhakaToday()): Promise<AdminRatesDto> {
    const found = await this.catalogRepository.ratesForDay(day);
    const latest = found
      .filter((r) => r.published_at !== null)
      .sort((a, b) => b.published_at!.getTime() - a.published_at!.getTime())[0];
    const num = (v: string | null) => (v === null ? null : Number(v));
    return {
      date: day,
      publishedAt: latest?.published_at?.toISOString() ?? null,
      publishedByName: latest?.published_by_name ?? null,
      rates: found.map((r) => ({
        categoryCode: r.code,
        pricingType: r.pricing_type,
        rate: num(r.rate_per_kg),
        previousRate: num(r.prev_rate),
        previousDate: r.prev_date,
      })),
    };
  }

  /** Publishes (or corrects) the rates for today or a future date. */
  async publishRates(adminId: string, input: PublishRatesDto): Promise<void> {
    const { effectiveDate, rates } = input;
    if (effectiveDate < dhakaToday()) {
      throw AppError.validation('Rates for past days cannot be changed. Pick today or a later date.');
    }
    const codes = rates.map((r) => r.categoryCode);
    if (new Set(codes).size !== codes.length) {
      throw AppError.validation('Each category can appear only once.');
    }
    const found = await this.catalogRepository.findByCodes(codes);
    const byCode = new Map(found.map((c) => [c.code, c]));
    const unknown = codes.filter((c) => !byCode.has(c));
    if (unknown.length) throw AppError.validation(`Unknown categories: ${unknown.join(', ')}.`);
    const notPerKg = found.filter((c) => c.pricingType !== 'PER_KG').map((c) => c.code);
    if (notPerKg.length) {
      throw AppError.validation(`These are priced on inspection and take no daily rate: ${notPerKg.join(', ')}.`);
    }

    await this.catalogRepository.upsertRates(
      effectiveDate,
      rates.map((r) => ({ categoryId: byCode.get(r.categoryCode)!.id, ratePerKg: r.ratePerKg })),
      adminId,
    );
  }

  private toCategoryDto(c: CategoryEntity): CategoryDto {
    return { code: c.code, nameBn: c.nameBn, nameEn: c.nameEn, pricingType: c.pricingType, icon: c.icon };
  }
}
