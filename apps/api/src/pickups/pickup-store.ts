import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Redis } from 'ioredis';
import type { DataSource, EntityManager } from 'typeorm';
import type { PickupStatus } from '@bw/shared';
import { CLOCK, type Clock } from '../common/clock.js';
import { AppError } from '../common/errors.js';
import { one, rows } from '../common/sql.js';
import { dhakaToday } from '../common/time.js';
import type { Env } from '../config/env.js';
import { REDIS } from '../redis/redis.module.js';
import { DOWNLOAD_URL_TTL_SEC, PHOTO_STORAGE, type PhotoStorage } from '../storage/storage.js';
import { hashPickupCode, newPickupCode } from './pickup-code.js';
import { canSeePickup, toPickupDto, type PickupDto } from './pickup.view.js';
import type {
  DisputeRow,
  ItemRow,
  PaymentRow,
  PhotoRow,
  PickupRecord,
  PickupRow,
  Viewer,
  WeighLineRow,
} from './records.js';
import { assertTransition, type Actor } from './state-machine.js';

export type Db = Pick<EntityManager, 'query'>;

/** The columns a write path needs, read with a row lock. */
export interface LockedPickup {
  id: string;
  display_no: string;
  status: PickupStatus;
  household_id: string;
  collector_id: string | null;
  pickup_code_hash: string | null;
  code_attempts: number;
  payment_method: 'CASH' | 'BKASH' | 'NAGAD' | null;
  wallet_number: string | null;
  total_amount: string | null;
  search_radius_m: number;
  expires_at: Date;
}

export interface ActorRef {
  id: string | null;
  role: Actor;
}

const PICKUP_COLUMNS = `
  p.id, p.display_no::text AS display_no, p.household_id, p.collector_id, p.address_text, p.area,
  ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng,
  p.slot_date::text AS slot_date, p.slot, p.weight_band, p.note, p.status, p.search_radius_m, p.code_attempts,
  p.payment_method, p.wallet_number, p.total_kg, p.total_amount, p.requested_at, p.accepted_at, p.arrived_at,
  p.weighed_at, p.confirmed_at, p.completed_at, p.cancelled_at, p.expires_at,
  h.name AS household_name, h.phone AS household_phone,
  c.name AS collector_name, c.phone AS collector_phone, cp.rating_avg AS collector_rating,
  ST_Y(cp.last_location::geometry) AS collector_lat, ST_X(cp.last_location::geometry) AS collector_lng,
  cp.last_seen_at AS collector_seen_at,
  r.stars AS rating_stars, r.comment AS rating_comment, r.created_at AS rated_at`;

const codeKey = (pickupId: string) => `bw:pcode:${pickupId}`;
const CODE_TTL_SEC = 3 * 86_400;

/**
 * Shared pickup data access: loading full records, locking rows, the one place status changes
 * are written (with their status_events row), pickup codes, and viewer-specific responses.
 */
@Injectable()
export class PickupStore {
  private readonly logger = new Logger('Pickups');

  constructor(
    @InjectDataSource() readonly db: DataSource,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(PHOTO_STORAGE) private readonly storage: PhotoStorage,
    @Inject(CLOCK) readonly clock: Clock,
    private readonly config: ConfigService<Env, true>,
  ) {}

  now(): Date {
    return this.clock.now();
  }

  /** Full records for these pickups, keyed by id, in a handful of queries. */
  async load(ids: string[], db: Db = this.db): Promise<Map<string, PickupRecord>> {
    const out = new Map<string, PickupRecord>();
    if (ids.length === 0) return out;
    const today = dhakaToday(this.now());
    const [pickups, items, lines, photos, payments, disputes] = await Promise.all([
      rows<PickupRow>(
        db,
        `SELECT ${PICKUP_COLUMNS}
           FROM pickups p
           JOIN users h ON h.id = p.household_id
           LEFT JOIN users c ON c.id = p.collector_id
           LEFT JOIN collector_profiles cp ON cp.user_id = p.collector_id
           LEFT JOIN ratings r ON r.pickup_id = p.id
          WHERE p.id = ANY($1::uuid[])`,
        [ids],
      ),
      rows<ItemRow>(
        db,
        `SELECT pi.pickup_id, pi.category_id, c.code, c.pricing_type, pi.rate_snapshot, c.sort_order,
                (SELECT d.rate_per_kg FROM daily_rates d
                  WHERE d.category_id = c.id AND d.effective_date <= $2
                  ORDER BY d.effective_date DESC LIMIT 1) AS current_rate
           FROM pickup_items pi JOIN categories c ON c.id = pi.category_id
          WHERE pi.pickup_id = ANY($1::uuid[])`,
        [ids, today],
      ),
      rows<WeighLineRow>(
        db,
        `SELECT w.pickup_id, w.version, c.code, w.kg, w.rate, w.amount, u.role AS created_by_role, w.created_at,
                c.sort_order
           FROM weigh_lines w
           JOIN categories c ON c.id = w.category_id
           JOIN users u ON u.id = w.created_by
          WHERE w.pickup_id = ANY($1::uuid[])
          ORDER BY w.version, c.sort_order`,
        [ids],
      ),
      rows<PhotoRow>(
        db,
        `SELECT id, pickup_id, kind, weigh_version, storage_key, uploaded_by, created_at
           FROM pickup_photos WHERE pickup_id = ANY($1::uuid[]) ORDER BY created_at`,
        [ids],
      ),
      rows<PaymentRow>(db, `SELECT * FROM payments WHERE pickup_id = ANY($1::uuid[])`, [ids]),
      this.disputeRows(db, `d.pickup_id = ANY($1::uuid[])`, [ids]),
    ]);
    for (const row of pickups) {
      row.lat = Number(row.lat);
      row.lng = Number(row.lng);
      out.set(row.id, {
        row,
        items: items.filter((i) => i.pickup_id === row.id),
        weighLines: lines.filter((l) => l.pickup_id === row.id),
        photos: photos.filter((p) => p.pickup_id === row.id),
        payment: payments.find((p) => p.pickup_id === row.id) ?? null,
        disputes: disputes.filter((d) => d.pickup_id === row.id),
      });
    }
    return out;
  }

  async loadOne(id: string, db: Db = this.db): Promise<PickupRecord | null> {
    return (await this.load([id], db)).get(id) ?? null;
  }

  disputeRows(db: Db, where: string, params: unknown[], suffix = 'ORDER BY d.created_at'): Promise<DisputeRow[]> {
    return rows<DisputeRow>(
      db,
      `SELECT d.id, d.pickup_id, p.display_no::text AS display_no, d.raised_by, d.type, d.status, d.reason,
              d.photo_ids, d.resolution, d.resolution_note, d.created_at, d.resolved_at
         FROM disputes d JOIN pickups p ON p.id = d.pickup_id
        WHERE ${where} ${suffix}`,
      params,
    );
  }

  /** Locks the pickup row for the rest of the transaction. */
  lock(tx: Db, id: string): Promise<LockedPickup | null> {
    return one<LockedPickup>(
      tx,
      `SELECT id, display_no::text AS display_no, status, household_id, collector_id, pickup_code_hash,
              code_attempts, payment_method, wallet_number, total_amount, search_radius_m, expires_at
         FROM pickups WHERE id = $1 FOR UPDATE`,
      [id],
    );
  }

  /** Locks the pickup and checks the user is its household, its collector, or (if allowed) an admin. */
  async lockFor(tx: Db, id: string, viewer: Viewer, allowAdmin = true): Promise<LockedPickup> {
    const p = await this.lock(tx, id);
    const mine =
      p &&
      ((viewer.role === 'HOUSEHOLD' && p.household_id === viewer.id) ||
        (viewer.role === 'COLLECTOR' && p.collector_id === viewer.id) ||
        (viewer.role === 'ADMIN' && allowAdmin));
    if (!p || !mine) throw AppError.notFound('That pickup was not found.');
    return p;
  }

  /**
   * The only way a pickup's status changes: checks the state machine, updates the row only if
   * its status is still `from`, and writes the status_events row in the same transaction.
   */
  async transition(
    tx: Db,
    current: { id: string; status: PickupStatus },
    to: PickupStatus,
    actor: ActorRef,
    set: Record<string, unknown> = {},
    meta: Record<string, unknown> | null = null,
  ): Promise<void> {
    assertTransition(current.status, to, actor.role);
    const entries = Object.entries(set);
    const assignments = entries.map(([col], i) => `, ${col} = $${i + 4}`).join('');
    const updated = await rows<{ id: string }>(
      tx,
      `UPDATE pickups SET status = $3${assignments} WHERE id = $1 AND status = $2 RETURNING id`,
      [current.id, current.status, to, ...entries.map(([, v]) => v)],
    );
    if (updated.length === 0) {
      throw AppError.invalidState('This pickup changed while you were working on it. Refresh to see the latest.');
    }
    await this.recordEvent(tx, current.id, current.status, to, actor, meta);
  }

  async recordEvent(
    tx: Db,
    pickupId: string,
    from: PickupStatus | null,
    to: PickupStatus,
    actor: ActorRef,
    meta: Record<string, unknown> | null = null,
  ): Promise<void> {
    await tx.query(
      `INSERT INTO status_events (pickup_id, from_status, to_status, actor_id, actor_role, meta, at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        pickupId,
        from,
        to,
        actor.id,
        actor.role === 'SYSTEM' ? null : actor.role,
        meta ? JSON.stringify(meta) : null,
        this.now(),
      ],
    );
  }

  private get codeSecret(): string {
    return this.config.get('JWT_SECRET', { infer: true });
  }

  /** A new code and its hash; the plain code goes to Redis after the transaction commits. */
  newCode(pickupId: string): { code: string; hash: string } {
    const code = newPickupCode();
    return { code, hash: hashPickupCode(this.codeSecret, pickupId, code) };
  }

  codeSecretForCheck(): string {
    return this.codeSecret;
  }

  async rememberCode(pickupId: string, code: string): Promise<void> {
    await this.redis.set(codeKey(pickupId), code, 'EX', CODE_TTL_SEC);
  }

  async forgetCode(pickupId: string): Promise<void> {
    await this.redis.del(codeKey(pickupId));
  }

  /**
   * The household's code while ACCEPTED. Only the hash is in the database, so if Redis lost the
   * plain code a new one is made (the collector has not entered it yet, so nothing breaks).
   */
  private async codeForHousehold(pickupId: string): Promise<string | null> {
    const cached = await this.redis.get(codeKey(pickupId));
    if (cached) return cached;
    const { code, hash } = this.newCode(pickupId);
    const updated = await rows<{ id: string }>(
      this.db,
      `UPDATE pickups SET pickup_code_hash = $2 WHERE id = $1 AND status = 'ACCEPTED' RETURNING id`,
      [pickupId, hash],
    );
    if (updated.length === 0) return null;
    this.logger.warn(`Pickup code for ${pickupId} was missing from Redis; issued a new one`);
    await this.rememberCode(pickupId, code);
    return code;
  }

  /** Presigned download links for every photo on these records. */
  private async photoUrls(records: PickupRecord[]): Promise<Map<string, string>> {
    const photos = records.flatMap((r) => r.photos);
    const urls = await Promise.all(photos.map((p) => this.storage.downloadUrl(p.storage_key, DOWNLOAD_URL_TTL_SEC)));
    return new Map(photos.map((p, i) => [p.id, urls[i]]));
  }

  async toDto(rec: PickupRecord, viewer: Viewer): Promise<PickupDto> {
    const showCode = viewer.role === 'HOUSEHOLD' && rec.row.household_id === viewer.id && rec.row.status === 'ACCEPTED';
    const [pickupCode, photoUrls] = await Promise.all([
      showCode ? this.codeForHousehold(rec.row.id) : Promise.resolve(null),
      this.photoUrls([rec]),
    ]);
    return toPickupDto(rec, viewer, { pickupCode, photoUrls });
  }

  /** The pickup as this viewer may see it; NOT_FOUND for anyone else. */
  async view(id: string, viewer: Viewer): Promise<PickupDto> {
    const rec = await this.loadOne(id);
    if (!rec || !canSeePickup(rec, viewer)) throw AppError.notFound('That pickup was not found.');
    return this.toDto(rec, viewer);
  }

  async viewMany(ids: string[], viewer: Viewer): Promise<PickupDto[]> {
    const records = await this.load(ids);
    return Promise.all(
      ids
        .map((id) => records.get(id))
        .filter((r): r is PickupRecord => r !== undefined)
        .map((r) => this.toDto(r, viewer)),
    );
  }
}
