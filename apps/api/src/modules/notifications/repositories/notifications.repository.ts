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
  dispute_status: string | null;
  stars: number | null;
  note: string | null;
}

export interface PickupFacts {
  pickup_id: string;
  category_codes: string[];
  payment_method: string | null;
  payment_amount: string | null;
  /** What the household confirmed (before payment). */
  confirmed_method: string | null;
  total_amount: string | null;
  household_name: string | null;
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
const RATES_SINCE_2 = ratesSince2();

const FEED = `
  WITH feed AS (
    SELECT 'se:' || se.id AS id,
           CASE
             WHEN se.to_status = 'ACCEPTED' THEN 'PICKUP_ACCEPTED'
             WHEN se.to_status = 'REQUESTED' THEN 'PICKUP_RELEASED'
             WHEN se.to_status = 'WEIGHED' THEN 'PICKUP_WEIGHED'
             WHEN se.to_status = 'COMPLETED' THEN 'PICKUP_PAID'
             WHEN se.to_status = 'EXPIRED' THEN 'PICKUP_EXPIRED'
             WHEN se.meta->>'reason' = 'NO_SHOW' THEN 'PICKUP_NO_SHOW'
             ELSE 'PICKUP_CANCELLED'
           END AS type,
           se.at, p.id AS pickup_id, 'BW-' || p.display_no AS display_no, a.name AS actor_name,
           CASE WHEN se.to_status = 'WEIGHED' THEN
             (SELECT max(w.version) FROM weigh_lines w WHERE w.pickup_id = p.id AND w.created_at <= se.at)
           END AS weigh_version,
           NULL::text AS dispute_type, NULL::text AS outcome, NULL::text AS effective_date,
           NULL::text AS dispute_status, NULL::int AS stars, NULL::text AS note
      FROM status_events se
      JOIN pickups p ON p.id = se.pickup_id
      LEFT JOIN users a ON a.id = se.actor_id
     WHERE p.household_id = $1
       AND se.actor_id IS DISTINCT FROM $1
       AND (se.to_status IN ('ACCEPTED', 'WEIGHED', 'COMPLETED', 'EXPIRED', 'CANCELLED')
            OR (se.to_status = 'REQUESTED' AND se.from_status = 'ACCEPTED'))
    UNION ALL
    SELECT 'dr:' || d.id, 'DISPUTE_RESOLVED', d.resolved_at, p.id, 'BW-' || p.display_no, NULL, NULL,
           d.type::text, d.resolution, NULL, NULL, NULL, NULL
      FROM disputes d
      JOIN pickups p ON p.id = d.pickup_id
     WHERE p.household_id = $1 AND d.resolved_at IS NOT NULL AND d.resolution NOT IN ('REWEIGHED', 'CANCEL')
    UNION ALL
    ${RATES_SINCE_2}
  )`;

/** One RATES_PUBLISHED per effective date up to today ($3), from $2 on. */
function ratesSince2(): string {
  return `SELECT 'rp:' || r.effective_date, 'RATES_PUBLISHED', r.at, NULL::uuid, NULL, NULL, NULL, NULL, NULL,
                 r.effective_date, NULL, NULL, NULL
            FROM (
              SELECT effective_date::text AS effective_date,
                     GREATEST(min(published_at), effective_date::timestamp AT TIME ZONE 'Asia/Dhaka') AS at
                FROM daily_rates
               WHERE effective_date <= $3::date
               GROUP BY effective_date
            ) r
           WHERE r.at >= $2`;
}

/**
 * The collector feed. $1 = collector id, $2 = when they were approved (rates before it are not news; the
 * far future while not approved), $3 = today in Dhaka. Only pickups still assigned to the collector.
 * - the application decision (APPLICATION_APPROVED / _REJECTED with the note)
 * - status_events by someone else: the household confirmed (pay now), rejected the weights (REWEIGH for the
 *   first weight dispute, ADMIN_REVIEW after), or the pickup was cancelled after accept
 * - a payment reported as not received, a resolved dispute (not REWEIGHED or CANCEL), a rating
 * - RATES_PUBLISHED as for households
 */
const COLLECTOR_FEED = `
  WITH feed AS (
    SELECT 'cv:' || cp.user_id || ':' || extract(epoch FROM cp.decided_at)::bigint AS id,
           CASE WHEN cp.verification_status = 'APPROVED' THEN 'APPLICATION_APPROVED' ELSE 'APPLICATION_REJECTED' END AS type,
           cp.decided_at AS at, NULL::uuid AS pickup_id, NULL::text AS display_no, NULL::text AS actor_name,
           NULL::int AS weigh_version, NULL::text AS dispute_type, NULL::text AS outcome, NULL::text AS effective_date,
           NULL::text AS dispute_status, NULL::int AS stars, cp.verification_note AS note
      FROM collector_profiles cp
     WHERE cp.user_id = $1 AND cp.decided_at IS NOT NULL AND cp.verification_status <> 'PENDING'
    UNION ALL
    SELECT 'se:' || se.id,
           CASE se.to_status WHEN 'CONFIRMED' THEN 'PICKUP_CONFIRMED' WHEN 'DISPUTED' THEN 'PICKUP_DISPUTED' ELSE 'PICKUP_CANCELLED' END,
           se.at, p.id, 'BW-' || p.display_no, a.name, NULL, CASE WHEN se.to_status = 'DISPUTED' THEN 'WEIGHT' END, NULL, NULL,
           CASE WHEN se.to_status = 'DISPUTED' THEN
             CASE WHEN (SELECT count(*) FROM disputes d WHERE d.pickup_id = p.id AND d.type = 'WEIGHT' AND d.created_at <= se.at) <= 1
                  THEN 'REWEIGH' ELSE 'ADMIN_REVIEW' END
           END,
           NULL, NULL
      FROM status_events se
      JOIN pickups p ON p.id = se.pickup_id
      LEFT JOIN users a ON a.id = se.actor_id
     WHERE p.collector_id = $1
       AND se.actor_id IS DISTINCT FROM $1
       AND (se.to_status IN ('CONFIRMED', 'DISPUTED')
            OR (se.to_status = 'CANCELLED' AND se.from_status <> 'REQUESTED'))
    UNION ALL
    SELECT 'pr:' || d.id, 'PAYMENT_REPORTED', d.created_at, p.id, 'BW-' || p.display_no, h.name, NULL, 'PAYMENT', NULL, NULL,
           NULL, NULL, NULL
      FROM disputes d JOIN pickups p ON p.id = d.pickup_id JOIN users h ON h.id = p.household_id
     WHERE p.collector_id = $1 AND d.type = 'PAYMENT'
    UNION ALL
    SELECT 'dr:' || d.id, 'DISPUTE_RESOLVED', d.resolved_at, p.id, 'BW-' || p.display_no, NULL, NULL, d.type::text,
           d.resolution, NULL, NULL, NULL, NULL
      FROM disputes d JOIN pickups p ON p.id = d.pickup_id
     WHERE p.collector_id = $1 AND d.resolved_at IS NOT NULL AND d.resolution NOT IN ('REWEIGHED', 'CANCEL')
    UNION ALL
    SELECT 'rt:' || r.pickup_id, 'RATED', r.created_at, p.id, 'BW-' || p.display_no, h.name, NULL, NULL, NULL, NULL,
           NULL, r.stars, NULL
      FROM ratings r JOIN pickups p ON p.id = r.pickup_id JOIN users h ON h.id = p.household_id
     WHERE p.collector_id = $1
    UNION ALL
    ${RATES_SINCE_2}
  )`;

export type FeedOwner = 'HOUSEHOLD' | 'COLLECTOR';
const feedFor = (owner: FeedOwner) => (owner === 'HOUSEHOLD' ? FEED : COLLECTOR_FEED);

@Injectable()
export class NotificationsRepository {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @InjectRepository(NotificationReadEntity) private readonly reads: Repository<NotificationReadEntity>,
  ) {}

  /** A page of the feed, newest first; `after` is the last item of the previous page. */
  page(
    owner: FeedOwner,
    userId: string,
    since: Date,
    today: string,
    limit: number,
    after: { at: string; id: string } | null,
  ): Promise<FeedRow[]> {
    return rows<FeedRow>(
      this.db,
      `${feedFor(owner)}
       SELECT * FROM feed
        WHERE ($4::timestamptz IS NULL OR (at, id) < ($4::timestamptz, $5::text))
        ORDER BY at DESC, id DESC
        LIMIT $6`,
      [userId, since, today, after?.at ?? null, after?.id ?? null, limit],
    );
  }

  async countAfter(owner: FeedOwner, userId: string, since: Date, today: string, seenAt: Date | null): Promise<number> {
    const [row] = await rows<{ n: string }>(
      this.db,
      `${feedFor(owner)} SELECT count(*) AS n FROM feed WHERE $4::timestamptz IS NULL OR at > $4::timestamptz`,
      [userId, since, today, seenAt],
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
              pay.method::text AS payment_method, pay.amount AS payment_amount,
              p.payment_method::text AS confirmed_method, p.total_amount, h.name AS household_name
         FROM pickups p LEFT JOIN payments pay ON pay.pickup_id = p.id JOIN users h ON h.id = p.household_id
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

  /** When the collector was approved, or null while not approved. */
  async approvedAt(collectorId: string): Promise<Date | null> {
    const [row] = await rows<{ decided_at: Date | null }>(
      this.db,
      `SELECT decided_at FROM collector_profiles WHERE user_id = $1 AND verification_status = 'APPROVED'`,
      [collectorId],
    );
    return row?.decided_at ?? null;
  }

  async seenAt(userId: string): Promise<Date | null> {
    return (await this.reads.findOne({ where: { userId } }))?.seenAt ?? null;
  }

  async markSeen(userId: string, at: Date): Promise<void> {
    await this.reads.upsert({ userId, seenAt: at }, ['userId']);
  }
}
