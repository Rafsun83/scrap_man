import { Injectable } from '@nestjs/common';
import { MATCHING, PICKUP_CODE_MAX_ATTEMPTS } from '@bw/shared';
import { AppError } from '../common/errors.js';
import { one, rows } from '../common/sql.js';
import { dhakaToday } from '../common/time.js';
import { PickupEvents } from './pickup-events.js';
import { PickupStore, type Db } from './pickup-store.js';
import { toNearbyRequest, type PickupDto } from './pickup.view.js';
import type { PickupRecord, Viewer } from './records.js';

interface CollectorProfileRow {
  verification_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  is_online: boolean;
  has_location: boolean;
  last_seen_at: Date | null;
}

/** Finding collectors for a request, the nearby list, and accept / release. */
@Injectable()
export class MatchingService {
  constructor(
    private readonly store: PickupStore,
    private readonly events: PickupEvents,
  ) {}

  private staleBefore(): Date {
    return new Date(this.store.now().getTime() - MATCHING.onlineStaleAfterMs);
  }

  /**
   * Online, approved, active collectors inside the pickup's current radius, with their distance.
   * `outsideM` skips those already reached at a smaller radius (used after widening).
   */
  collectorsAround(
    db: Db,
    pickupId: string,
    opts: { outsideM?: number; exclude?: string[] } = {},
  ): Promise<{ userId: string; distanceM: number }[]> {
    return rows<{ userId: string; distanceM: number }>(
      db,
      `SELECT cp.user_id AS "userId", ST_Distance(cp.last_location, p.location)::int AS "distanceM"
         FROM pickups p
         JOIN collector_profiles cp
           ON cp.is_online AND cp.verification_status = 'APPROVED' AND cp.last_location IS NOT NULL
          AND cp.last_seen_at > $2
          AND ST_DWithin(cp.last_location, p.location, p.search_radius_m)
          AND ($3::int IS NULL OR NOT ST_DWithin(cp.last_location, p.location, $3::int))
         JOIN users u ON u.id = cp.user_id AND u.status = 'ACTIVE'
        WHERE p.id = $1 AND NOT (cp.user_id = ANY($4::uuid[]))
        ORDER BY 2`,
      [pickupId, this.staleBefore(), opts.outsideM ?? null, opts.exclude ?? []],
    );
  }

  /** Sends request.created to the collectors who can now see this request. */
  async announce(pickupId: string, opts: { outsideM?: number; exclude?: string[] } = {}): Promise<number> {
    const [rec, collectors] = await Promise.all([
      this.store.loadOne(pickupId),
      this.collectorsAround(this.store.db, pickupId, opts),
    ]);
    if (!rec || rec.row.status !== 'REQUESTED') return 0;
    this.events.requestCreated(rec, collectors);
    return collectors.length;
  }

  async approvedProfile(collectorId: string): Promise<CollectorProfileRow> {
    const profile = await one<CollectorProfileRow>(
      this.store.db,
      `SELECT verification_status, is_online, last_location IS NOT NULL AS has_location, last_seen_at
         FROM collector_profiles WHERE user_id = $1`,
      [collectorId],
    );
    if (!profile || profile.verification_status !== 'APPROVED') throw AppError.notApproved();
    return profile;
  }

  /** Open requests whose current radius reaches this point, nearest first. */
  async nearby(collector: Viewer, lat: number, lng: number) {
    await this.approvedProfile(collector.id);
    const found = await rows<{ id: string; distance_m: number }>(
      this.store.db,
      `SELECT p.id, ST_Distance(p.location, q.pt)::int AS distance_m
         FROM pickups p,
              (SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography AS pt) q
        WHERE p.status = 'REQUESTED' AND p.expires_at > $3
          AND ST_DWithin(p.location, q.pt, p.search_radius_m)
        ORDER BY distance_m
        LIMIT 50`,
      [lat, lng, this.store.now()],
    );
    const records = await this.store.load(found.map((f) => f.id));
    return found
      .map((f) => ({ rec: records.get(f.id), distance: f.distance_m }))
      .filter((x): x is { rec: PickupRecord; distance: number } => x.rec !== undefined)
      .map((x) => toNearbyRequest(x.rec, x.distance));
  }

  /**
   * First accept wins: one UPDATE that only matches while the request is still REQUESTED,
   * unexpired and within reach of the collector's last location. Rates are copied onto the
   * pickup and a pickup code is created in the same transaction.
   */
  async accept(collector: Viewer, pickupId: string): Promise<PickupDto> {
    const profile = await this.approvedProfile(collector.id);
    if (!profile.is_online || !profile.has_location || !profile.last_seen_at || profile.last_seen_at < this.staleBefore()) {
      throw AppError.outOfRange('Go online and share your location before accepting a request.');
    }
    const now = this.store.now();
    const { code, hash } = this.store.newCode(pickupId);

    const outcome = await this.store.db.transaction(async (tx) => {
      const won = await rows<{ id: string }>(
        tx,
        `UPDATE pickups p
            SET status = 'ACCEPTED', collector_id = $2, accepted_at = $3, pickup_code_hash = $4, code_attempts = 0
           FROM collector_profiles cp
          WHERE p.id = $1 AND p.status = 'REQUESTED' AND p.expires_at > $3
            AND cp.user_id = $2 AND ST_DWithin(cp.last_location, p.location, p.search_radius_m)
          RETURNING p.id`,
        [pickupId, collector.id, now, hash],
      );
      if (won.length === 0) return this.whyNotAccepted(tx, pickupId, collector.id, now);

      await this.store.recordEvent(tx, pickupId, 'REQUESTED', 'ACCEPTED', collector);
      await tx.query(
        `UPDATE pickup_items pi
            SET rate_snapshot = (SELECT d.rate_per_kg FROM daily_rates d
                                  WHERE d.category_id = pi.category_id AND d.effective_date <= $2
                                  ORDER BY d.effective_date DESC LIMIT 1)
           FROM categories c
          WHERE pi.pickup_id = $1 AND c.id = pi.category_id AND c.pricing_type = 'PER_KG'`,
        [pickupId, dhakaToday(now)],
      );
      return 'ACCEPTED' as const;
    });
    if (outcome !== 'ACCEPTED') throw outcome;

    await this.store.rememberCode(pickupId, code);
    const rec = (await this.store.loadOne(pickupId))!;
    this.events.changed('pickup.accepted', rec.row, 'ACCEPTED', now);
    const others = await this.collectorsAround(this.store.db, pickupId, { exclude: [collector.id] });
    this.events.requestTaken(pickupId, 'ACCEPTED', others.map((c) => c.userId));
    return this.store.toDto(rec, collector);
  }

  /** Explains a lost accept with the contract's error codes. */
  private async whyNotAccepted(db: Db, pickupId: string, collectorId: string, now: Date): Promise<AppError> {
    const p = await one<{ status: string; expires_at: Date; distance_m: number | null; search_radius_m: number }>(
      db,
      `SELECT p.status, p.expires_at, p.search_radius_m,
              ST_Distance(cp.last_location, p.location)::int AS distance_m
         FROM pickups p LEFT JOIN collector_profiles cp ON cp.user_id = $2
        WHERE p.id = $1`,
      [pickupId, collectorId],
    );
    if (!p) return AppError.notFound('That request was not found.');
    if (p.status === 'CANCELLED') return AppError.invalidState('The household cancelled this request.', { status: p.status });
    if (p.status === 'EXPIRED' || (p.status === 'REQUESTED' && p.expires_at <= now)) {
      return AppError.invalidState('This request has expired.', { status: 'EXPIRED' });
    }
    if (p.status !== 'REQUESTED') return AppError.alreadyTaken();
    return AppError.outOfRange('This request is too far from your location to accept.', {
      distanceM: p.distance_m,
      searchRadiusM: p.search_radius_m,
    });
  }

  /** The collector gives the request back: it opens again at 1 km with a fresh 5-minute clock. */
  async release(collector: Viewer, pickupId: string, reason?: string): Promise<void> {
    const now = this.store.now();
    const released = await this.store.db.transaction(async (tx) => {
      const p = await this.store.lockFor(tx, pickupId, collector, false);
      if (p.status === 'ACCEPTED' && p.code_attempts >= PICKUP_CODE_MAX_ATTEMPTS) throw AppError.codeLocked();
      await this.store.transition(
        tx,
        p,
        'REQUESTED',
        collector,
        {
          collector_id: null,
          accepted_at: null,
          pickup_code_hash: null,
          code_attempts: 0,
          search_radius_m: MATCHING.initialRadiusM,
          search_started_at: now,
        },
        { release: true, reason: reason ?? null },
      );
      await tx.query(`UPDATE pickup_items SET rate_snapshot = NULL WHERE pickup_id = $1`, [pickupId]);
      return p;
    });
    await this.store.forgetCode(pickupId);
    this.events.changed('pickup.released', { ...released, collector_id: null }, 'REQUESTED', now, [collector.id]);
    await this.announce(pickupId, { exclude: [collector.id] });
  }
}
