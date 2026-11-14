import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MATCHING } from '@bw/shared';
import { CLOCK, type Clock } from '../common/clock.js';
import { rows } from '../common/sql.js';
import type { Env } from '../config/env.js';
import { MatchingService } from '../pickups/matching.service.js';
import { PickupEvents } from '../pickups/pickup-events.js';
import { PickupStore } from '../pickups/pickup-store.js';

export const SWEEP_EVERY_MS = 15_000;

interface Swept {
  id: string;
  display_no: string;
  household_id: string;
}

/**
 * Time-based matching rules, swept every 15 seconds:
 * - widening: a request still at 1 km 5 minutes after matching started goes to 3 km;
 * - expiry: a request nobody accepted expires at the end of its booked slot.
 * Each sweep is one conditional UPDATE ... RETURNING, so several API processes never double-apply.
 */
@Injectable()
export class MatchingJobs implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('MatchingJobs');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly store: PickupStore,
    private readonly matching: MatchingService,
    private readonly events: PickupEvents,
    private readonly config: ConfigService<Env, true>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.get('JOBS_ENABLED', { infer: true })) return;
    this.timer = setInterval(() => void this.tick(), SWEEP_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.runOnce(this.clock.now());
    } catch (error) {
      this.logger.error(`Sweep failed: ${error instanceof Error ? error.stack : String(error)}`);
    } finally {
      this.running = false;
    }
  }

  async runOnce(now: Date): Promise<{ widened: string[]; expired: string[] }> {
    const expired = await this.expire(now);
    const widened = await this.widen(now);
    return { widened, expired };
  }

  async widen(now: Date): Promise<string[]> {
    const cutoff = new Date(now.getTime() - MATCHING.widenAfterMs);
    const widened = await this.store.db.transaction(async (tx) => {
      const found = await rows<Swept>(
        tx,
        `UPDATE pickups SET search_radius_m = $1
          WHERE status = 'REQUESTED' AND search_radius_m < $1 AND search_started_at <= $2 AND expires_at > $3
          RETURNING id, display_no::text AS display_no, household_id`,
        [MATCHING.widenedRadiusM, cutoff, now],
      );
      await this.recordEvents(tx, found, 'REQUESTED', now, { searchRadiusM: MATCHING.widenedRadiusM });
      return found;
    });
    for (const p of widened) {
      await this.matching.announce(p.id, { outsideM: MATCHING.initialRadiusM });
    }
    if (widened.length) this.logger.log(`Widened ${widened.length} request(s) to ${MATCHING.widenedRadiusM} m`);
    return widened.map((p) => p.id);
  }

  async expire(now: Date): Promise<string[]> {
    const expired = await this.store.db.transaction(async (tx) => {
      const found = await rows<Swept>(
        tx,
        `UPDATE pickups SET status = 'EXPIRED'
          WHERE status = 'REQUESTED' AND expires_at <= $1
          RETURNING id, display_no::text AS display_no, household_id`,
        [now],
      );
      await this.recordEvents(tx, found, 'EXPIRED', now, null);
      return found;
    });
    for (const p of expired) {
      this.events.changed('request.expired', { ...p, collector_id: null }, 'EXPIRED', now);
      const reached = await this.matching.collectorsAround(this.store.db, p.id);
      this.events.requestTaken(p.id, 'EXPIRED', reached.map((c) => c.userId));
    }
    if (expired.length) this.logger.log(`Expired ${expired.length} request(s)`);
    return expired.map((p) => p.id);
  }

  private async recordEvents(
    tx: Parameters<PickupStore['lock']>[0],
    found: Swept[],
    to: 'REQUESTED' | 'EXPIRED',
    now: Date,
    meta: Record<string, unknown> | null,
  ): Promise<void> {
    if (found.length === 0) return;
    await tx.query(
      `INSERT INTO status_events (pickup_id, from_status, to_status, actor_id, actor_role, meta, at)
       SELECT unnest($1::uuid[]), 'REQUESTED', $2, NULL, NULL, $3, $4`,
      [found.map((p) => p.id), to, meta ? JSON.stringify(meta) : null, now],
    );
  }
}
