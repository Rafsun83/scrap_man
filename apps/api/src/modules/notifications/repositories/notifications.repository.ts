import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { DataSource, Repository } from 'typeorm';
import { rows } from '../../../common/sql.js';
import { NotificationReadEntity } from '../entities/notification-read.entity.js';

/** One feed item before enrichment. */
export interface FeedRow {
  id: string;
  type: string;
  at: Date;
  pickup_id: string | null;
  display_no: string | null;
  actor_name: string | null;
  weigh_version: number | null;
  dispute_type: string | null;
  outcome: string | null;
  effective_date: string | null;
}

export interface PickupFacts {
  pickup_id: string;
  category_codes: string[];
  payment_method: string | null;
  payment_amount: string | null;
}

export interface WeighTotals {
  pickup_id: string;
  version: number;
  total_kg: string;
  total_amount: string;
}

/**
 * The household feed, read from what already happened (a read model; this module never writes those
 * tables). $1 = household id, $2 = account creation time (rates before it are not news), $3 = today in Dhaka.
 * - status_events by someone other than the household: accepted, released (ACCEPTED -> REQUESTED),
 *   weighed, paid (COMPLETED), expired, cancelled.
 * - resolved disputes, except REWEIGHED and CANCEL (those already appear as weighed or cancelled).
 * - one RATES_PUBLISHED per effective date, dated when it took effect or was published, whichever is later.
 */
const FEED = `
  WITH feed AS (
    SELECT 'se:' || se.id AS id,
           CASE
             WHEN se.to_status = 'ACCEPTED' THEN 'PICKUP_ACCEPTED'
             WHEN se.to_status = 'REQUESTED' THEN 'PICKUP_RELEASED'
             WHEN se.to_status = 'WEIGHED' THEN 'PICKUP_WEIGHED'
             WHEN se.to_status = 'COMPLETED' THEN 'PICKUP_PAID'
             WHEN se.to_status = 'EXPIRED' THEN 'PICKUP_EXPIRED'
             ELSE 'PICKUP_CANCELLED'
           END AS type,
           se.at, p.id AS pickup_id, 'BW-' || p.display_no AS display_no, a.name AS actor_name,
           CASE WHEN se.to_status = 'WEIGHED' THEN
             (SELECT max(w.version) FROM weigh_lines w WHERE w.pickup_id = p.id AND w.created_at <= se.at)
           END AS weigh_version,
           NULL::text AS dispute_type, NULL::text AS outcome, NULL::text AS effective_date
      FROM status_events se
      JOIN pickups p ON p.id = se.pickup_id
      LEFT JOIN users a ON a.id = se.actor_id
     WHERE p.household_id = $1
       AND se.actor_id IS DISTINCT FROM $1
       AND (se.to_status IN ('ACCEPTED', 'WEIGHED', 'COMPLETED', 'EXPIRED', 'CANCELLED')
            OR (se.to_status = 'REQUESTED' AND se.from_status = 'ACCEPTED'))
    UNION ALL
    SELECT 'dr:' || d.id, 'DISPUTE_RESOLVED', d.resolved_at, p.id, 'BW-' || p.display_no, NULL, NULL,
           d.type::text, d.resolution, NULL
      FROM disputes d
      JOIN pickups p ON p.id = d.pickup_id
     WHERE p.household_id = $1 AND d.resolved_at IS NOT NULL AND d.resolution NOT IN ('REWEIGHED', 'CANCEL')
    UNION ALL
    SELECT 'rp:' || r.effective_date, 'RATES_PUBLISHED', r.at, NULL, NULL, NULL, NULL, NULL, NULL, r.effective_date
      FROM (
        SELECT effective_date::text AS effective_date,
               GREATEST(min(published_at), effective_date::timestamp AT TIME ZONE 'Asia/Dhaka') AS at
          FROM daily_rates
         WHERE effective_date <= $3::date
         GROUP BY effective_date
      ) r
     WHERE r.at >= $2
  )`;

@Injectable()
export class NotificationsRepository {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @InjectRepository(NotificationReadEntity) private readonly reads: Repository<NotificationReadEntity>,
  ) {}

  /** A page of the feed, newest first; `after` is the last item of the previous page. */
  page(
    householdId: string,
    since: Date,
    today: string,
    limit: number,
    after: { at: string; id: string } | null,
  ): Promise<FeedRow[]> {
    return rows<FeedRow>(
      this.db,
      `${FEED}
       SELECT * FROM feed
        WHERE ($4::timestamptz IS NULL OR (at, id) < ($4::timestamptz, $5::text))
        ORDER BY at DESC, id DESC
        LIMIT $6`,
      [householdId, since, today, after?.at ?? null, after?.id ?? null, limit],
    );
  }

  async countAfter(householdId: string, since: Date, today: string, seenAt: Date | null): Promise<number> {
    const [row] = await rows<{ n: string }>(
      this.db,
      `${FEED} SELECT count(*) AS n FROM feed WHERE $4::timestamptz IS NULL OR at > $4::timestamptz`,
      [householdId, since, today, seenAt],
    );
    return Number(row?.n ?? 0);
  }

  /** Categories (display order) and payment for the pickups on a page. */
  pickupFacts(pickupIds: string[]): Promise<PickupFacts[]> {
    if (pickupIds.length === 0) return Promise.resolve([]);
    return rows<PickupFacts>(
      this.db,
      `SELECT p.id AS pickup_id,
              ARRAY(SELECT c.code FROM pickup_items pi JOIN categories c ON c.id = pi.category_id
                     WHERE pi.pickup_id = p.id ORDER BY c.sort_order) AS category_codes,
              pay.method::text AS payment_method, pay.amount AS payment_amount
         FROM pickups p LEFT JOIN payments pay ON pay.pickup_id = p.id
        WHERE p.id = ANY($1::uuid[])`,
      [pickupIds],
    );
  }

  /** Totals of each weigh round of these pickups. */
  weighTotals(pickupIds: string[]): Promise<WeighTotals[]> {
    if (pickupIds.length === 0) return Promise.resolve([]);
    return rows<WeighTotals>(
      this.db,
      `SELECT pickup_id, version, sum(kg) AS total_kg, sum(amount) AS total_amount
         FROM weigh_lines WHERE pickup_id = ANY($1::uuid[])
        GROUP BY pickup_id, version`,
      [pickupIds],
    );
  }

  async seenAt(userId: string): Promise<Date | null> {
    return (await this.reads.findOne({ where: { userId } }))?.seenAt ?? null;
  }

  async markSeen(userId: string, at: Date): Promise<void> {
    await this.reads.upsert({ userId, seenAt: at }, ['userId']);
  }
}
