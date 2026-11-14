import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { DataSource, Repository } from 'typeorm';
import { AppError } from '../common/errors.js';
import { dhakaToday } from '../common/time.js';
import { CategoryEntity } from './category.entity.js';
import { buildTodayRates, type RateRow } from './rates.js';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(CategoryEntity) private readonly categories: Repository<CategoryEntity>,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  activeCategories(): Promise<CategoryEntity[]> {
    return this.categories.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  /** The latest published rate per category up to today, and the rate before it. */
  async todayRates() {
    const today = dhakaToday();
    const rows: RateRow[] = await this.db.query(
      `SELECT c.code, c.pricing_type, cur.rate_per_kg, cur.effective_date::text AS effective_date,
              cur.published_at, prev.rate_per_kg AS prev_rate
         FROM categories c
         LEFT JOIN LATERAL (
           SELECT d.rate_per_kg, d.effective_date, d.published_at
             FROM daily_rates d
            WHERE d.category_id = c.id AND d.effective_date <= $1
            ORDER BY d.effective_date DESC LIMIT 1
         ) cur ON true
         LEFT JOIN LATERAL (
           SELECT d.rate_per_kg
             FROM daily_rates d
            WHERE d.category_id = c.id AND d.effective_date < cur.effective_date
            ORDER BY d.effective_date DESC LIMIT 1
         ) prev ON true
        WHERE c.is_active
        ORDER BY c.sort_order`,
      [today],
    );
    return buildTodayRates(rows, today);
  }

  /** Publishes (or corrects) the rates for today or a future date. */
  async publishRates(
    adminId: string,
    effectiveDate: string,
    rates: { categoryCode: string; ratePerKg: number }[],
  ): Promise<void> {
    if (effectiveDate < dhakaToday()) {
      throw AppError.validation('Rates for past days cannot be changed. Pick today or a later date.');
    }
    const codes = rates.map((r) => r.categoryCode);
    if (new Set(codes).size !== codes.length) {
      throw AppError.validation('Each category can appear only once.');
    }
    const found = await this.categories.find({ where: codes.map((code) => ({ code })) });
    const byCode = new Map(found.map((c) => [c.code, c]));
    const unknown = codes.filter((c) => !byCode.has(c));
    if (unknown.length) throw AppError.validation(`Unknown categories: ${unknown.join(', ')}.`);
    const notPerKg = found.filter((c) => c.pricingType !== 'PER_KG').map((c) => c.code);
    if (notPerKg.length) {
      throw AppError.validation(`These are priced on inspection and take no daily rate: ${notPerKg.join(', ')}.`);
    }

    await this.db.transaction(async (tx) => {
      for (const r of rates) {
        await tx.query(
          `INSERT INTO daily_rates (category_id, effective_date, rate_per_kg, published_by, published_at)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (category_id, effective_date)
           DO UPDATE SET rate_per_kg = EXCLUDED.rate_per_kg,
                         published_by = EXCLUDED.published_by,
                         published_at = now()`,
          [byCode.get(r.categoryCode)!.id, effectiveDate, r.ratePerKg, adminId],
        );
      }
    });
  }
}
