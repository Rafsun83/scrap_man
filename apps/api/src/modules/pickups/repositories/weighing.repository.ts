import { Injectable } from '@nestjs/common';
import { one, rows, type Db } from '../../../common/sql.js';
import type { PricingType } from '../../catalog/enums/pricing-type.enum.js';

export interface WeighItemRow {
  category_id: string;
  code: string;
  pricing_type: PricingType;
  rate_snapshot: string | null;
}

export interface WeighLineInput {
  pickupId: string;
  categoryId: string;
  version: number;
  kg: string;
  rate: string | null;
  amount: string;
  createdBy: string;
  at: Date;
}

/** Versioned weigh rounds (weigh_lines) and the items they price. */
@Injectable()
export class WeighingRepository {
  itemsOf(tx: Db, pickupId: string): Promise<WeighItemRow[]> {
    return rows<WeighItemRow>(
      tx,
      `SELECT pi.category_id, c.code, c.pricing_type, pi.rate_snapshot
         FROM pickup_items pi JOIN categories c ON c.id = pi.category_id WHERE pi.pickup_id = $1`,
      [pickupId],
    );
  }

  /**
   * Active categories by code with the rate in effect on `today` (null for ON_INSPECTION, or a
   * PER_KG category that has never had a rate). For items found at the door.
   */
  activeCategoriesWithRate(tx: Db, codes: string[], today: string): Promise<WeighItemRow[]> {
    return rows<WeighItemRow>(
      tx,
      `SELECT c.id AS category_id, c.code, c.pricing_type,
              CASE WHEN c.pricing_type = 'PER_KG' THEN
                (SELECT d.rate_per_kg FROM daily_rates d
                  WHERE d.category_id = c.id AND d.effective_date <= $2
                  ORDER BY d.effective_date DESC LIMIT 1)
              END AS rate_snapshot
         FROM categories c WHERE c.is_active AND c.code = ANY($1::text[])`,
      [codes, today],
    );
  }

  /** Adds an item the household did not list, with its rate copied now. */
  async addItem(tx: Db, pickupId: string, categoryId: string, rate: string | null): Promise<void> {
    await tx.query(`INSERT INTO pickup_items (pickup_id, category_id, rate_snapshot) VALUES ($1, $2, $3)`, [
      pickupId,
      categoryId,
      rate,
    ]);
  }

  async nextVersion(tx: Db, pickupId: string): Promise<number> {
    const row = await one<{ v: number }>(
      tx,
      `SELECT COALESCE(max(version), 0)::int AS v FROM weigh_lines WHERE pickup_id = $1`,
      [pickupId],
    );
    return row!.v + 1;
  }

  async insertLine(tx: Db, l: WeighLineInput): Promise<void> {
    await tx.query(
      `INSERT INTO weigh_lines (pickup_id, category_id, version, kg, rate, amount, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [l.pickupId, l.categoryId, l.version, l.kg, l.rate, l.amount, l.createdBy, l.at],
    );
  }
}
