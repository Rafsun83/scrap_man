import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { DataSource, Repository } from 'typeorm';
import { rows } from '../../../common/sql.js';
import { CategoryEntity } from '../entities/category.entity.js';
import type { PricingType } from '../enums/pricing-type.enum.js';

/** A category's latest rate up to a day, and the rate before it; numeric columns arrive as strings. */
export interface RateRow {
  code: string;
  pricing_type: PricingType;
  rate_per_kg: string | null;
  prev_rate: string | null;
  effective_date: string | null;
  published_at: Date | null;
}

/** Categories and their daily rates. */
@Injectable()
export class CatalogRepository {
  constructor(
    @InjectRepository(CategoryEntity) private readonly categories: Repository<CategoryEntity>,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  activeCategories(): Promise<CategoryEntity[]> {
    return this.categories.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  findByCodes(codes: string[]): Promise<CategoryEntity[]> {
    return this.categories.find({ where: codes.map((code) => ({ code })) });
  }

  /** Active categories in display order with the rate in effect on `day` and the one before it. */
  ratesOn(day: string): Promise<RateRow[]> {
    return rows<RateRow>(
      this.db,
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
      [day],
    );
  }

  /** Inserts or overwrites each category's rate for the day, all in one transaction. */
  async upsertRates(
    effectiveDate: string,
    rates: { categoryId: string; ratePerKg: number }[],
    publishedBy: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const r of rates) {
        await tx.query(
          `INSERT INTO daily_rates (category_id, effective_date, rate_per_kg, published_by, published_at)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (category_id, effective_date)
           DO UPDATE SET rate_per_kg = EXCLUDED.rate_per_kg,
                         published_by = EXCLUDED.published_by,
                         published_at = now()`,
          [r.categoryId, effectiveDate, r.ratePerKg, publishedBy],
        );
      }
    });
  }
}
