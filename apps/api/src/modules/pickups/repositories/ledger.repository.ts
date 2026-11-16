import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { PaymentMethod } from '@bw/shared';
import { one, rows } from '../../../common/sql.js';

export interface LedgerPaymentRow {
  pickup_id: string;
  household_name: string | null;
  method: PaymentMethod;
  trx_id: string | null;
  amount: string;
  paid_at: Date;
  total_kg: string | null;
}

export interface LedgerCategoryRow {
  code: string;
  kg: string;
}

export interface CollectorStatsRow {
  pickups_30d: number;
  releases_30d: number;
}

/**
 * Joined as `pay` (payments) and `p` (pickups): the collector's paid pickups between two Dhaka dates,
 * inclusive. A pickup counts once its payment is PAID or VERIFIED; a REPORTED one drops out until settled.
 */
const PAID_IN_RANGE = `p.collector_id = $1 AND p.status = 'COMPLETED' AND pay.status IN ('PAID', 'VERIFIED')
   AND pay.paid_at >= ($2::date)::timestamp AT TIME ZONE 'Asia/Dhaka'
   AND pay.paid_at < ($3::date + 1)::timestamp AT TIME ZONE 'Asia/Dhaka'`;

/** Collector ledger and recent-activity counts, summed in the database. */
@Injectable()
export class LedgerRepository {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** Paid pickups in the range, newest payment first. */
  payments(collectorId: string, from: string, to: string): Promise<LedgerPaymentRow[]> {
    return rows<LedgerPaymentRow>(
      this.db,
      `SELECT p.id AS pickup_id, u.name AS household_name, pay.method, pay.trx_id, pay.amount, pay.paid_at, p.total_kg
         FROM payments pay
         JOIN pickups p ON p.id = pay.pickup_id
         JOIN users u ON u.id = p.household_id
        WHERE ${PAID_IN_RANGE}
        ORDER BY pay.paid_at DESC, p.id`,
      [collectorId, from, to],
    );
  }

  /** Kg per category from each paid pickup's final weigh round, largest first. */
  byCategory(collectorId: string, from: string, to: string): Promise<LedgerCategoryRow[]> {
    return rows<LedgerCategoryRow>(
      this.db,
      `SELECT c.code, sum(w.kg) AS kg
         FROM payments pay
         JOIN pickups p ON p.id = pay.pickup_id
         JOIN weigh_lines w ON w.pickup_id = p.id
          AND w.version = (SELECT max(w2.version) FROM weigh_lines w2 WHERE w2.pickup_id = p.id)
         JOIN categories c ON c.id = w.category_id
        WHERE ${PAID_IN_RANGE}
        GROUP BY c.code, c.sort_order
        ORDER BY sum(w.kg) DESC, c.sort_order`,
      [collectorId, from, to],
    );
  }

  /** Completed pickups and requests given back in the 30 days before `now`. */
  async stats30d(collectorId: string, now: Date): Promise<CollectorStatsRow> {
    const row = await one<CollectorStatsRow>(
      this.db,
      `SELECT
         (SELECT count(*)::int FROM pickups
           WHERE collector_id = $1 AND status = 'COMPLETED' AND completed_at > $2::timestamptz - interval '30 days') AS pickups_30d,
         (SELECT count(*)::int FROM status_events
           WHERE actor_id = $1 AND from_status = 'ACCEPTED' AND to_status = 'REQUESTED'
             AND at > $2::timestamptz - interval '30 days') AS releases_30d`,
      [collectorId, now],
    );
    return row ?? { pickups_30d: 0, releases_30d: 0 };
  }
}
