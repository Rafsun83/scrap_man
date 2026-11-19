import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Redis } from 'ioredis';
import type { DataSource } from 'typeorm';
import { rows } from '../../../common/sql.js';
import { REDIS } from '../../redis/redis.module.js';
import type { OpsAlertKind } from '../dtos/ops-alert.dto.js';

export interface AlertRow {
  kind: Exclude<OpsAlertKind, 'OTP_FAILURES'>;
  pickup_id: string;
  display_no: string;
  user_id: string | null;
  name: string | null;
  since: Date;
}

export interface AlertCutoffs {
  /** ACCEPTED pickups whose slot ended before this. */
  slotEndedBefore: Date;
  /** CONFIRMED pickups confirmed before this. */
  confirmedBefore: Date;
  /** Disputes with staff since before this. */
  reviewBefore: Date;
  /** Payment reports and no-shows after this. */
  recentAfter: Date;
}

const SEEN_KEY = 'bw:ops:alerts:seen';

/**
 * Read model for ops alerts over the pickups tables (this module never writes them), and the set of alert ids
 * already announced, in Redis.
 */
@Injectable()
export class OpsAlertsRepository {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  pickupAlerts(c: AlertCutoffs): Promise<AlertRow[]> {
    return rows<AlertRow>(
      this.db,
      `SELECT 'ACCEPTED_PAST_SLOT' AS kind, p.id AS pickup_id, p.display_no::text AS display_no, p.collector_id AS user_id,
              u.name, p.expires_at AS since
         FROM pickups p LEFT JOIN users u ON u.id = p.collector_id
        WHERE p.status = 'ACCEPTED' AND p.expires_at < $1
       UNION ALL
       SELECT 'CONFIRMED_UNPAID', p.id, p.display_no::text, p.collector_id, u.name, p.confirmed_at
         FROM pickups p LEFT JOIN users u ON u.id = p.collector_id
        WHERE p.status = 'CONFIRMED' AND p.confirmed_at < $2
       UNION ALL
       SELECT 'REVIEW_OVERDUE', p.id, p.display_no::text, p.collector_id, u.name, d.created_at
         FROM disputes d JOIN pickups p ON p.id = d.pickup_id LEFT JOIN users u ON u.id = p.collector_id
        WHERE d.status = 'ADMIN_REVIEW' AND d.created_at < $3
       UNION ALL
       SELECT 'PAYMENT_REPORTED', p.id, p.display_no::text, p.collector_id, u.name, d.created_at
         FROM disputes d JOIN pickups p ON p.id = d.pickup_id LEFT JOIN users u ON u.id = p.collector_id
        WHERE d.type = 'PAYMENT' AND d.status <> 'RESOLVED' AND d.created_at > $4
       UNION ALL
       SELECT 'NO_SHOW', p.id, p.display_no::text, se.actor_id, u.name, se.at
         FROM status_events se JOIN pickups p ON p.id = se.pickup_id LEFT JOIN users u ON u.id = se.actor_id
        WHERE se.to_status = 'CANCELLED' AND se.meta->>'reason' = 'NO_SHOW' AND se.at > $4
       LIMIT 500`,
      [c.slotEndedBefore, c.confirmedBefore, c.reviewBefore, c.recentAfter],
    );
  }

  /** Marks these alert ids announced; returns the ones that were not announced before. */
  async markSeen(ids: string[]): Promise<string[]> {
    const fresh: string[] = [];
    for (const id of ids) if ((await this.redis.sadd(SEEN_KEY, id)) === 1) fresh.push(id);
    await this.redis.expire(SEEN_KEY, 7 * 24 * 3600);
    return fresh;
  }
}
