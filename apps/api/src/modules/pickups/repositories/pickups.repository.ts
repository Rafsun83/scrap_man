import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import type { PickupStatus, Role, TimeSlot, WeightBand } from '@bw/shared';
import { one, rows, type Db } from '../../../common/sql.js';
import type { PricingType } from '../../catalog/enums/pricing-type.enum.js';
import type {
  ItemRow,
  LockedPickup,
  PaymentRow,
  PhotoRow,
  PickupRecord,
  PickupRow,
  WeighLineRow,
} from '../types/pickup-record.types.js';

/** A pickup record without its disputes (those come from DisputesRepository). */
export type PickupRecordWithoutDisputes = Omit<PickupRecord, 'disputes'>;

export interface StatusEventInput {
  pickupId: string;
  from: PickupStatus | null;
  to: PickupStatus;
  actorId: string | null;
  actorRole: Role | null;
  meta: Record<string, unknown> | null;
  at: Date;
}

export interface NewRequestInput {
  householdId: string;
  addressId: string;
  addressText: string;
  slotDate: string;
  slot: TimeSlot;
  weightBand: WeightBand;
  note: string | null;
  searchRadiusM: number;
  now: Date;
  expiresAt: Date;
}

export interface RequestAddressRow {
  id: string;
  line: string;
  area: string;
  city: string;
  note: string | null;
}

export interface RequestCategoryRow {
  id: string;
  code: string;
  pricing_type: PricingType;
  rate: string | null;
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

/**
 * Pickups, their items, status events and ratings. Reads join the people around a pickup
 * (users, collector profiles, addresses, categories, rates) as a read model.
 */
@Injectable()
export class PickupsRepository {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  transaction<T>(work: (tx: EntityManager) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  /** Full records for these pickups, keyed by id, in a handful of queries. `today` prices unaccepted items. */
  async loadRecords(ids: string[], today: string, db: Db = this.db): Promise<Map<string, PickupRecordWithoutDisputes>> {
    const out = new Map<string, PickupRecordWithoutDisputes>();
    if (ids.length === 0) return out;
    const [pickups, items, lines, photos, payments] = await Promise.all([
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
      });
    }
    return out;
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

  /**
   * Sets the status (and other columns) only if the status is still `from`.
   * `set` keys are column names chosen by the services, never user input. Returns false if nothing matched.
   */
  async updateStatusIf(
    tx: Db,
    id: string,
    from: PickupStatus,
    to: PickupStatus,
    set: Record<string, unknown>,
  ): Promise<boolean> {
    const entries = Object.entries(set);
    const assignments = entries.map(([col], i) => `, ${col} = $${i + 4}`).join('');
    const updated = await rows<{ id: string }>(
      tx,
      `UPDATE pickups SET status = $3${assignments} WHERE id = $1 AND status = $2 RETURNING id`,
      [id, from, to, ...entries.map(([, v]) => v)],
    );
    return updated.length > 0;
  }

  async insertStatusEvent(tx: Db, e: StatusEventInput): Promise<void> {
    await tx.query(
      `INSERT INTO status_events (pickup_id, from_status, to_status, actor_id, actor_role, meta, at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [e.pickupId, e.from, e.to, e.actorId, e.actorRole, e.meta ? JSON.stringify(e.meta) : null, e.at],
    );
  }

  /** One system event (no actor) per pickup, for the matching sweeps. */
  async insertSystemEvents(
    tx: Db,
    pickupIds: string[],
    from: PickupStatus,
    to: PickupStatus,
    meta: Record<string, unknown> | null,
    at: Date,
  ): Promise<void> {
    if (pickupIds.length === 0) return;
    await tx.query(
      `INSERT INTO status_events (pickup_id, from_status, to_status, actor_id, actor_role, meta, at)
       SELECT unnest($1::uuid[]), $2, $3, NULL, NULL, $4, $5`,
      [pickupIds, from, to, meta ? JSON.stringify(meta) : null, at],
    );
  }

  findHouseholdAddress(householdId: string, addressId: string): Promise<RequestAddressRow | null> {
    return one<RequestAddressRow>(
      this.db,
      `SELECT id, line, area, city, note FROM addresses WHERE id = $1 AND user_id = $2`,
      [addressId, householdId],
    );
  }

  /** Active categories with these codes and the rate in effect on `today`. */
  categoriesWithRates(codes: string[], today: string): Promise<RequestCategoryRow[]> {
    return rows<RequestCategoryRow>(
      this.db,
      `SELECT c.id, c.code, c.pricing_type,
              (SELECT d.rate_per_kg FROM daily_rates d
                WHERE d.category_id = c.id AND d.effective_date <= $2
                ORDER BY d.effective_date DESC LIMIT 1) AS rate
         FROM categories c WHERE c.code = ANY($1::text[]) AND c.is_active`,
      [codes, today],
    );
  }

  /** Inserts a REQUESTED pickup, copying the location from the address. Returns its id. */
  async insertRequest(tx: Db, input: NewRequestInput): Promise<string> {
    const created = await one<{ id: string }>(
      tx,
      `INSERT INTO pickups (household_id, address_id, address_text, area, location, slot_date, slot, weight_band,
                            note, status, search_radius_m, requested_at, search_started_at, expires_at)
       SELECT $1, a.id, $3, a.area, a.location, $4, $5, $6, $7, 'REQUESTED', $8, $9, $9, $10
         FROM addresses a WHERE a.id = $2
       RETURNING id`,
      [
        input.householdId,
        input.addressId,
        input.addressText,
        input.slotDate,
        input.slot,
        input.weightBand,
        input.note,
        input.searchRadiusM,
        input.now,
        input.expiresAt,
      ],
    );
    return created!.id;
  }

  async insertItems(tx: Db, pickupId: string, categoryIds: string[]): Promise<void> {
    await tx.query(`INSERT INTO pickup_items (pickup_id, category_id) SELECT $1, unnest($2::uuid[])`, [pickupId, categoryIds]);
  }

  /** Copies the rate in effect on `today` onto each per-kg item. */
  async snapshotRates(tx: Db, pickupId: string, today: string): Promise<void> {
    await tx.query(
      `UPDATE pickup_items pi
          SET rate_snapshot = (SELECT d.rate_per_kg FROM daily_rates d
                                WHERE d.category_id = pi.category_id AND d.effective_date <= $2
                                ORDER BY d.effective_date DESC LIMIT 1)
         FROM categories c
        WHERE pi.pickup_id = $1 AND c.id = pi.category_id AND c.pricing_type = 'PER_KG'`,
      [pickupId, today],
    );
  }

  async clearRates(tx: Db, pickupId: string): Promise<void> {
    await tx.query(`UPDATE pickup_items SET rate_snapshot = NULL WHERE pickup_id = $1`, [pickupId]);
  }

  /** A page of one owner's pickups, newest first; `after` is the last item of the previous page. */
  pageIds(
    owner: 'household_id' | 'collector_id',
    ownerId: string,
    statuses: readonly PickupStatus[] | null,
    after: { at: string; id: string } | null,
    limit: number,
  ): Promise<{ id: string; requested_at: Date }[]> {
    return rows<{ id: string; requested_at: Date }>(
      this.db,
      `SELECT id, requested_at FROM pickups
        WHERE ${owner} = $1
          AND ($2::pickup_status[] IS NULL OR status = ANY($2::pickup_status[]))
          AND ($3::timestamptz IS NULL OR (requested_at, id) < ($3::timestamptz, $4::uuid))
        ORDER BY requested_at DESC, id DESC
        LIMIT $5`,
      [ownerId, statuses, after?.at ?? null, after?.id ?? null, limit],
    );
  }

  /** Completed pickups of a household with their final kg and taka, summed in the database. */
  completedTotals(householdId: string): Promise<{ completed_count: string; total_kg: string; total_amount: string } | null> {
    return one(
      this.db,
      `SELECT count(*) AS completed_count, COALESCE(sum(total_kg), 0) AS total_kg,
              COALESCE(sum(total_amount), 0) AS total_amount
         FROM pickups WHERE household_id = $1 AND status = 'COMPLETED'`,
      [householdId],
    );
  }

  /** ACCEPTED pickups of this collector (for live location). */
  acceptedByCollector(collectorId: string): Promise<{ id: string; household_id: string }[]> {
    return rows<{ id: string; household_id: string }>(
      this.db,
      `SELECT id, household_id FROM pickups WHERE collector_id = $1 AND status = 'ACCEPTED'`,
      [collectorId],
    );
  }

  /** Replaces the code hash while the pickup is ACCEPTED; false when it no longer is. */
  async setCodeHashIfAccepted(pickupId: string, hash: string): Promise<boolean> {
    const updated = await rows<{ id: string }>(
      this.db,
      `UPDATE pickups SET pickup_code_hash = $2 WHERE id = $1 AND status = 'ACCEPTED' RETURNING id`,
      [pickupId, hash],
    );
    return updated.length > 0;
  }

  async setCodeAttempts(tx: Db, pickupId: string, attempts: number): Promise<void> {
    await tx.query(`UPDATE pickups SET code_attempts = $2 WHERE id = $1`, [pickupId, attempts]);
  }

  /** One rating per pickup; false when it already has one. */
  async insertRating(tx: Db, pickupId: string, stars: number, comment: string | null, at: Date): Promise<boolean> {
    const saved = await rows<{ pickup_id: string }>(
      tx,
      `INSERT INTO ratings (pickup_id, stars, comment, created_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (pickup_id) DO NOTHING RETURNING pickup_id`,
      [pickupId, stars, comment, at],
    );
    return saved.length > 0;
  }
}
