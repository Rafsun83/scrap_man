import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { LatLng } from '../../../common/geo.js';
import { one, type Db } from '../../../common/sql.js';
import type { VerificationStatus } from '../enums/verification-status.enum.js';

/** What matching needs to know about a collector right now. */
export interface CollectorAvailabilityRow {
  verification_status: VerificationStatus;
  is_online: boolean;
  has_location: boolean;
  last_seen_at: Date | null;
}

const POINT = `ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography`;

@Injectable()
export class CollectorProfilesRepository {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  findAvailability(userId: string): Promise<CollectorAvailabilityRow | null> {
    return one<CollectorAvailabilityRow>(
      this.db,
      `SELECT verification_status, is_online, last_location IS NOT NULL AS has_location, last_seen_at
         FROM collector_profiles WHERE user_id = $1`,
      [userId],
    );
  }

  async setOnlineAt(userId: string, online: boolean, location: LatLng, now: Date): Promise<void> {
    await this.db.query(
      `UPDATE collector_profiles SET is_online = $4, last_location = ${POINT}, last_seen_at = $5, updated_at = $5
        WHERE user_id = $1`,
      [userId, location.lat, location.lng, online, now],
    );
  }

  async setOnline(userId: string, online: boolean, now: Date): Promise<void> {
    await this.db.query(`UPDATE collector_profiles SET is_online = $2, updated_at = $3 WHERE user_id = $1`, [
      userId,
      online,
      now,
    ]);
  }

  async saveLocation(userId: string, location: LatLng, now: Date): Promise<void> {
    await this.db.query(`UPDATE collector_profiles SET last_location = ${POINT}, last_seen_at = $4 WHERE user_id = $1`, [
      userId,
      location.lat,
      location.lng,
      now,
    ]);
  }

  async takeOffline(db: Db, userId: string, now: Date): Promise<void> {
    await db.query(`UPDATE collector_profiles SET is_online = false, updated_at = $2 WHERE user_id = $1`, [userId, now]);
  }

  /** Recomputes the average from every rating of this collector's pickups (read from the pickups tables). */
  async refreshRating(db: Db, userId: string): Promise<void> {
    await db.query(
      `UPDATE collector_profiles SET rating_avg = (
         SELECT round(avg(r.stars)::numeric, 1) FROM ratings r JOIN pickups p ON p.id = r.pickup_id
          WHERE p.collector_id = $1)
       WHERE user_id = $1`,
      [userId],
    );
  }
}
