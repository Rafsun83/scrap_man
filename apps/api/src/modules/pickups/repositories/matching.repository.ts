import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { PickupStatus } from '@bw/shared';
import { one, rows, type Db } from '../../../common/sql.js';
import type { PickupRef } from '../types/pickup-record.types.js';

export interface CollectorDistance {
  userId: string;
  distanceM: number;
  /** Direction from the request to the collector, 0 = north, clockwise. */
  bearingDeg: number;
}

export interface RadarFacts {
  household_id: string;
  status: PickupStatus;
  search_radius_m: number;
}

export interface AcceptFailureFacts {
  status: PickupStatus;
  expires_at: Date;
  distance_m: number | null;
  search_radius_m: number;
}

/** Spatial matching between requests and online collectors (PostGIS), first accept wins, and the sweeps. */
@Injectable()
export class MatchingRepository {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Online, approved, active collectors seen after `staleBefore` inside the pickup's current radius,
   * nearest first. `outsideM` skips those within a smaller radius; `exclude` skips these users.
   */
  collectorsAround(
    pickupId: string,
    staleBefore: Date,
    outsideM: number | null,
    exclude: string[],
    db: Db = this.db,
  ): Promise<CollectorDistance[]> {
    return rows<CollectorDistance>(
      db,
      `SELECT cp.user_id AS "userId", ST_Distance(cp.last_location, p.location)::int AS "distanceM",
              COALESCE(degrees(ST_Azimuth(p.location, cp.last_location)), 0)::int AS "bearingDeg"
         FROM pickups p
         JOIN collector_profiles cp
           ON cp.is_online AND cp.verification_status = 'APPROVED' AND cp.last_location IS NOT NULL
          AND cp.last_seen_at > $2
          AND ST_DWithin(cp.last_location, p.location, p.search_radius_m)
          AND ($3::int IS NULL OR NOT ST_DWithin(cp.last_location, p.location, $3::int))
         JOIN users u ON u.id = cp.user_id AND u.status = 'ACTIVE'
        WHERE p.id = $1 AND NOT (cp.user_id = ANY($4::uuid[]))
        ORDER BY 2`,
      [pickupId, staleBefore, outsideM, exclude],
    );
  }

  /** Owner, status and radius of a request, for its radar; null when it does not exist. */
  radarFacts(pickupId: string): Promise<RadarFacts | null> {
    return one<RadarFacts>(this.db, 'SELECT household_id, status, search_radius_m FROM pickups WHERE id = $1', [pickupId]);
  }

  /** Open, unexpired requests whose current radius reaches this point, nearest first (at most 50). */
  nearbyRequests(lat: number, lng: number, now: Date): Promise<{ id: string; distance_m: number }[]> {
    return rows<{ id: string; distance_m: number }>(
      this.db,
      `SELECT p.id, ST_Distance(p.location, q.pt)::int AS distance_m
         FROM pickups p,
              (SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography AS pt) q
        WHERE p.status = 'REQUESTED' AND p.expires_at > $3
          AND ST_DWithin(p.location, q.pt, p.search_radius_m)
        ORDER BY distance_m
        LIMIT 50`,
      [lat, lng, now],
    );
  }

  /**
   * First accept wins: one UPDATE that only matches while the request is still REQUESTED,
   * unexpired and within reach of the collector's last location. False when another accept won.
   */
  async acceptIfOpen(tx: Db, pickupId: string, collectorId: string, now: Date, codeHash: string): Promise<boolean> {
    const won = await rows<{ id: string }>(
      tx,
      `UPDATE pickups p
          SET status = 'ACCEPTED', collector_id = $2, accepted_at = $3, pickup_code_hash = $4, code_attempts = 0
         FROM collector_profiles cp
        WHERE p.id = $1 AND p.status = 'REQUESTED' AND p.expires_at > $3
          AND cp.user_id = $2 AND ST_DWithin(cp.last_location, p.location, p.search_radius_m)
        RETURNING p.id`,
      [pickupId, collectorId, now, codeHash],
    );
    return won.length > 0;
  }

  /** Why an accept did not match: status, expiry and the collector's distance. */
  acceptFailureFacts(tx: Db, pickupId: string, collectorId: string): Promise<AcceptFailureFacts | null> {
    return one<AcceptFailureFacts>(
      tx,
      `SELECT p.status, p.expires_at, p.search_radius_m,
              ST_Distance(cp.last_location, p.location)::int AS distance_m
         FROM pickups p LEFT JOIN collector_profiles cp ON cp.user_id = $2
        WHERE p.id = $1`,
      [pickupId, collectorId],
    );
  }

  /** Widens requests still searching below `radiusM` since before `cutoff`. */
  widenDue(tx: Db, radiusM: number, cutoff: Date, now: Date): Promise<PickupRef[]> {
    return rows<PickupRef>(
      tx,
      `UPDATE pickups SET search_radius_m = $1
        WHERE status = 'REQUESTED' AND search_radius_m < $1 AND search_started_at <= $2 AND expires_at > $3
        RETURNING id, display_no::text AS display_no, household_id, NULL::uuid AS collector_id`,
      [radiusM, cutoff, now],
    );
  }

  /** Expires requests whose booked slot has ended. */
  expireDue(tx: Db, now: Date): Promise<PickupRef[]> {
    return rows<PickupRef>(
      tx,
      `UPDATE pickups SET status = 'EXPIRED'
        WHERE status = 'REQUESTED' AND expires_at <= $1
        RETURNING id, display_no::text AS display_no, household_id, NULL::uuid AS collector_id`,
      [now],
    );
  }
}
