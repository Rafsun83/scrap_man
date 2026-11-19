import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { Role, UserStatus, VerificationStatus } from '@bw/shared';
import { one, rows } from '../../../common/sql.js';
import type { Language } from '../../users/enums/language.enum.js';

export interface StatusCountsRow {
  requested: number;
  accepted: number;
  weighing: number;
  disputed: number;
  confirmed: number;
  completed_today: number;
  pending_applications: number;
  open_disputes: number;
}

export interface AttentionRow {
  kind: 'WAITING_TOO_LONG' | 'CODE_LOCKED' | 'DISPUTE_REVIEW' | 'RELEASES' | 'NO_SHOW';
  pickup_id: string | null;
  display_no: string | null;
  area: string | null;
  user_id: string | null;
  name: string | null;
  since: Date;
  count: number | null;
}

export interface MapRequestRow {
  id: string;
  display_no: string;
  area: string;
  lat: number;
  lng: number;
  requested_at: Date;
}

export interface MapCollectorRow {
  user_id: string;
  name: string | null;
  lat: number;
  lng: number;
  last_seen_at: Date;
  busy: boolean;
}

export interface AdminUserDbRow {
  id: string;
  phone: string;
  role: Role;
  name: string | null;
  language: Language;
  status: UserStatus;
  status_note: string | null;
  created_at: Date;
  home_area: string | null;
  completed_count: number;
  total_received: string;
  no_shows_30d: number;
  has_profile: boolean;
  work_areas: string[] | null;
  rating_avg: string | null;
  verification_status: VerificationStatus | null;
  is_online: boolean | null;
  pickups_30d: number;
  releases_30d: number;
}

/** A release: the assigned collector gave an ACCEPTED request back. */
const RELEASE = `from_status = 'ACCEPTED' AND to_status = 'REQUESTED'`;

/**
 * Read model for the admin panel (A1 overview and map, A5 users). It only reads tables owned by the pickups,
 * users and collectors code; every change goes through those modules' services.
 */
@Injectable()
export class AdminReadRepository {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** Pickups now in each status, completed since `dayStart`, pending applications and open disputes. */
  async counts(dayStart: Date): Promise<StatusCountsRow> {
    const row = await one<StatusCountsRow>(
      this.db,
      `SELECT
         count(*) FILTER (WHERE status = 'REQUESTED')::int AS requested,
         count(*) FILTER (WHERE status = 'ACCEPTED')::int AS accepted,
         count(*) FILTER (WHERE status IN ('ARRIVED', 'WEIGHED'))::int AS weighing,
         count(*) FILTER (WHERE status = 'DISPUTED')::int AS disputed,
         count(*) FILTER (WHERE status = 'CONFIRMED')::int AS confirmed,
         count(*) FILTER (WHERE status = 'COMPLETED' AND completed_at >= $1)::int AS completed_today,
         (SELECT count(*)::int FROM collector_profiles WHERE verification_status = 'PENDING') AS pending_applications,
         (SELECT count(*)::int FROM disputes WHERE status <> 'RESOLVED') AS open_disputes
       FROM pickups
       WHERE status <> 'EXPIRED' AND status <> 'CANCELLED'`,
      [dayStart],
    );
    return row!;
  }

  /**
   * Things operations should look at, most urgent kind first: locked codes, disputes waiting for staff,
   * requests waiting too long (oldest first), collectors giving back too many requests. At most 20 of each.
   */
  attention(now: Date, waitingSince: Date, releasesSince: Date, maxReleases: number, maxCodeAttempts: number): Promise<AttentionRow[]> {
    return rows<AttentionRow>(
      this.db,
      `(SELECT 'CODE_LOCKED' AS kind, p.id AS pickup_id, p.display_no::text AS display_no, p.area,
               p.collector_id AS user_id, c.name, p.accepted_at AS since, NULL::int AS count, 1 AS rank
          FROM pickups p LEFT JOIN users c ON c.id = p.collector_id
         WHERE p.status = 'ACCEPTED' AND p.code_attempts >= $5
         ORDER BY p.accepted_at LIMIT 20)
       UNION ALL
       (SELECT 'DISPUTE_REVIEW', p.id, p.display_no::text, p.area, NULL, NULL, d.created_at, NULL, 2
          FROM disputes d JOIN pickups p ON p.id = d.pickup_id
         WHERE d.status = 'ADMIN_REVIEW'
         ORDER BY d.created_at LIMIT 20)
       UNION ALL
       (SELECT 'NO_SHOW', p.id, p.display_no::text, p.area, se.actor_id, u.name, se.at, NULL, 3
          FROM status_events se JOIN pickups p ON p.id = se.pickup_id LEFT JOIN users u ON u.id = se.actor_id
         WHERE se.to_status = 'CANCELLED' AND se.meta->>'reason' = 'NO_SHOW' AND se.at > $1::timestamptz - interval '24 hours'
         ORDER BY se.at DESC LIMIT 20)
       UNION ALL
       (SELECT 'WAITING_TOO_LONG', p.id, p.display_no::text, p.area, NULL, NULL, p.requested_at, NULL, 4
          FROM pickups p
         WHERE p.status = 'REQUESTED' AND p.requested_at < $2 AND p.expires_at > $1
         ORDER BY p.requested_at LIMIT 20)
       UNION ALL
       (SELECT 'RELEASES', NULL, NULL, NULL, se.actor_id, u.name, max(se.at), count(*)::int, 5
          FROM status_events se JOIN users u ON u.id = se.actor_id
         WHERE se.${RELEASE} AND se.at > $3
         GROUP BY se.actor_id, u.name
        HAVING count(*) > $4
         ORDER BY count(*) DESC LIMIT 20)
       ORDER BY rank, since`,
      [now, waitingSince, releasesSince, maxReleases, maxCodeAttempts],
    );
  }

  /** Open, unexpired requests with their exact point. */
  openRequests(now: Date): Promise<MapRequestRow[]> {
    return rows<MapRequestRow>(
      this.db,
      `SELECT p.id, p.display_no::text AS display_no, p.area, ST_Y(p.location::geometry) AS lat,
              ST_X(p.location::geometry) AS lng, p.requested_at
         FROM pickups p
        WHERE p.status = 'REQUESTED' AND p.expires_at > $1
        ORDER BY p.requested_at
        LIMIT 500`,
      [now],
    );
  }

  /** Approved, active collectors online and seen after `seenAfter`, and whether they have an active pickup. */
  onlineCollectors(seenAfter: Date): Promise<MapCollectorRow[]> {
    return rows<MapCollectorRow>(
      this.db,
      `SELECT cp.user_id, u.name, ST_Y(cp.last_location::geometry) AS lat, ST_X(cp.last_location::geometry) AS lng,
              cp.last_seen_at,
              EXISTS (SELECT 1 FROM pickups p WHERE p.collector_id = cp.user_id
                       AND p.status IN ('ACCEPTED', 'ARRIVED', 'WEIGHED', 'DISPUTED', 'CONFIRMED')) AS busy
         FROM collector_profiles cp JOIN users u ON u.id = cp.user_id AND u.status <> 'SUSPENDED'
        WHERE cp.is_online AND cp.verification_status = 'APPROVED' AND cp.last_location IS NOT NULL
          AND cp.last_seen_at > $1
        LIMIT 500`,
      [seenAfter],
    );
  }

  /**
   * A5: households or collectors, newest account first, with their figures. `q` matches the name, or the
   * phone by its digits.
   */
  users(
    role: 'HOUSEHOLD' | 'COLLECTOR',
    q: string | null,
    releasesSince: Date,
    after: { at: string; id: string } | null,
    limit: number,
  ): Promise<AdminUserDbRow[]> {
    const digits = q?.replace(/[^0-9]/g, '') || null;
    return rows<AdminUserDbRow>(
      this.db,
      `SELECT u.id, u.phone, u.role, u.name, u.language, u.status, u.status_note, u.created_at,
              home.area AS home_area,
              COALESCE(done.n, 0)::int AS completed_count, COALESCE(done.total, 0) AS total_received,
              COALESCE(ns.n, 0)::int AS no_shows_30d,
              cp.user_id IS NOT NULL AS has_profile, cp.work_areas, cp.rating_avg, cp.verification_status, cp.is_online,
              COALESCE(work.n, 0)::int AS pickups_30d, COALESCE(rel.n, 0)::int AS releases_30d
         FROM users u
         LEFT JOIN LATERAL (
           SELECT a.area FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_default DESC, a.created_at LIMIT 1
         ) home ON u.role = 'HOUSEHOLD'
         LEFT JOIN LATERAL (
           SELECT count(*) AS n, sum(p.total_amount) AS total FROM pickups p
            WHERE p.household_id = u.id AND p.status = 'COMPLETED'
         ) done ON u.role = 'HOUSEHOLD'
         LEFT JOIN LATERAL (
           SELECT count(*) AS n FROM status_events se JOIN pickups p ON p.id = se.pickup_id
            WHERE p.household_id = u.id AND se.to_status = 'CANCELLED' AND se.meta->>'reason' = 'NO_SHOW' AND se.at > $3
         ) ns ON u.role = 'HOUSEHOLD'
         LEFT JOIN collector_profiles cp ON cp.user_id = u.id
         LEFT JOIN LATERAL (
           SELECT count(*) AS n FROM pickups p
            WHERE p.collector_id = u.id AND p.status = 'COMPLETED' AND p.completed_at > $3
         ) work ON u.role = 'COLLECTOR'
         LEFT JOIN LATERAL (
           SELECT count(*) AS n FROM status_events se WHERE se.actor_id = u.id AND se.${RELEASE} AND se.at > $3
         ) rel ON u.role = 'COLLECTOR'
        WHERE u.role = $1::user_role
          AND ($2::text IS NULL OR u.name ILIKE '%' || $2 || '%' OR ($4::text IS NOT NULL AND u.phone LIKE '%' || $4 || '%'))
          AND ($5::timestamptz IS NULL OR (u.created_at, u.id) < ($5::timestamptz, $6::uuid))
        ORDER BY u.created_at DESC, u.id DESC
        LIMIT $7`,
      [role, q, releasesSince, digits, after?.at ?? null, after?.id ?? null, limit],
    );
  }
}
