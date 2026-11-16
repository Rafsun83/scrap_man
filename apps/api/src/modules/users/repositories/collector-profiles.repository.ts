import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { LatLng } from '../../../common/geo.js';
import { one, rows, type Db } from '../../../common/sql.js';
import type { VerificationStatus } from '../enums/verification-status.enum.js';
import type {
  CollectorApplication,
  CollectorProfileRow,
  CollectorWorkChanges,
} from '../types/collector-application.types.js';

/** What matching needs to know about a collector right now. */
export interface CollectorAvailabilityRow {
  verification_status: VerificationStatus;
  is_online: boolean;
  has_location: boolean;
  last_seen_at: Date | null;
}

const POINT = `ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography`;

const PROFILE_COLUMNS = `cp.user_id, u.name, u.phone, cp.nid_number, cp.nid_verified, cp.selfie_id, cp.work_areas,
  cp.vehicle_type, cp.has_scale, cp.verification_status, cp.verification_note, cp.submitted_at, cp.decided_at,
  cp.is_online, cp.rating_avg`;

@Injectable()
export class CollectorProfilesRepository {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  findWithUser(userId: string): Promise<CollectorProfileRow | null> {
    return one<CollectorProfileRow>(
      this.db,
      `SELECT ${PROFILE_COLUMNS} FROM collector_profiles cp JOIN users u ON u.id = cp.user_id WHERE cp.user_id = $1`,
      [userId],
    );
  }

  /**
   * Saves a new application, or a new one after a rejection, as PENDING in one statement.
   * False when a PENDING or APPROVED profile already exists (nothing is changed).
   */
  async submitApplication(a: CollectorApplication, now: Date): Promise<boolean> {
    const saved = await rows<{ user_id: string }>(
      this.db,
      `INSERT INTO collector_profiles AS cp
              (user_id, nid_number, selfie_id, work_areas, vehicle_type, has_scale, verification_status,
               submitted_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $7, $7)
       ON CONFLICT (user_id) DO UPDATE
          SET nid_number = EXCLUDED.nid_number, selfie_id = EXCLUDED.selfie_id, work_areas = EXCLUDED.work_areas,
              vehicle_type = EXCLUDED.vehicle_type, has_scale = EXCLUDED.has_scale, verification_status = 'PENDING',
              verification_note = NULL, decided_at = NULL, decided_by = NULL, submitted_at = $7, updated_at = $7
        WHERE cp.verification_status = 'REJECTED'
       RETURNING cp.user_id`,
      [a.userId, a.nidNumber, a.selfieId, a.workAreas, a.vehicleType, a.hasScale, now],
    );
    return saved.length > 0;
  }

  /** Changes only the given work details. False when the collector has no profile. */
  async updateWork(userId: string, c: CollectorWorkChanges, now: Date): Promise<boolean> {
    const saved = await rows<{ user_id: string }>(
      this.db,
      `UPDATE collector_profiles
          SET work_areas = COALESCE($2::text[], work_areas),
              vehicle_type = COALESCE($3::vehicle_type, vehicle_type),
              has_scale = COALESCE($4::boolean, has_scale),
              updated_at = $5
        WHERE user_id = $1
       RETURNING user_id`,
      [userId, c.workAreas ?? null, c.vehicleType ?? null, c.hasScale ?? null, now],
    );
    return saved.length > 0;
  }

  /** Records an admin's decision while the application is PENDING. False otherwise. */
  async decide(
    userId: string,
    decision: Exclude<VerificationStatus, 'PENDING'>,
    note: string | null,
    adminId: string,
    now: Date,
  ): Promise<boolean> {
    const saved = await rows<{ user_id: string }>(
      this.db,
      `UPDATE collector_profiles
          SET verification_status = $2, verification_note = $3, decided_at = $5, decided_by = $4, updated_at = $5
        WHERE user_id = $1 AND verification_status = 'PENDING'
       RETURNING user_id`,
      [userId, decision, note, adminId, now],
    );
    return saved.length > 0;
  }

  /** Profiles in this status (any when null), oldest application first, after the cursor. */
  page(
    status: VerificationStatus | null,
    after: { at: string; id: string } | null,
    limit: number,
  ): Promise<CollectorProfileRow[]> {
    return rows<CollectorProfileRow>(
      this.db,
      `SELECT ${PROFILE_COLUMNS} FROM collector_profiles cp JOIN users u ON u.id = cp.user_id
        WHERE ($1::verification_status IS NULL OR cp.verification_status = $1::verification_status)
          AND ($2::timestamptz IS NULL OR (cp.submitted_at, cp.user_id) > ($2::timestamptz, $3::uuid))
        ORDER BY cp.submitted_at, cp.user_id
        LIMIT $4`,
      [status, after?.at ?? null, after?.id ?? null, limit],
    );
  }

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
