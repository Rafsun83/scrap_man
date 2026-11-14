import { Injectable } from '@nestjs/common';
import { ACTIVE_PICKUP_STATUSES, MATCHING, type PickupStatus, type TimeSlot, type WeightBand } from '@bw/shared';
import { randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { one, rows } from '../common/sql.js';
import { dhakaToday } from '../common/time.js';
import { PHOTO_STORAGE, UPLOAD_URL_TTL_SEC, type PhotoStorage } from '../storage/storage.js';
import { MatchingService } from './matching.service.js';
import { PickupEvents } from './pickup-events.js';
import { PickupStore } from './pickup-store.js';
import type { PickupDto } from './pickup.view.js';
import type { Viewer } from './records.js';
import { bookableSlotEnd } from './slots.js';

export interface CreatePickupInput {
  addressId: string;
  categoryCodes: string[];
  weightBand: WeightBand;
  slotDate: string;
  slot: TimeSlot;
  note?: string;
}

const MAX_PHOTOS_PER_PICKUP = 30;
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;
export type PhotoContentType = keyof typeof EXTENSIONS;

const LIST_FILTERS: Record<'ACTIVE' | 'COMPLETED' | 'CANCELLED', readonly PickupStatus[]> = {
  ACTIVE: ACTIVE_PICKUP_STATUSES,
  COMPLETED: ['COMPLETED'],
  CANCELLED: ['CANCELLED', 'EXPIRED'],
};

/** Creating, reading, listing and cancelling pickups, photo upload slots and ratings. */
@Injectable()
export class PickupsService {
  constructor(
    private readonly store: PickupStore,
    private readonly matching: MatchingService,
    private readonly events: PickupEvents,
    @Inject(PHOTO_STORAGE) private readonly storage: PhotoStorage,
  ) {}

  async create(household: Viewer, input: CreatePickupInput): Promise<PickupDto> {
    const now = this.store.now();
    const db = this.store.db;
    const address = await one<{ id: string; line: string; area: string; city: string; note: string | null }>(
      db,
      `SELECT id, line, area, city, note FROM addresses WHERE id = $1 AND user_id = $2`,
      [input.addressId, household.id],
    );
    if (!address) throw AppError.notFound('That address was not found. Pick one of your saved addresses.');

    const codes = [...new Set(input.categoryCodes)];
    const categories = await rows<{ id: string; code: string; pricing_type: string; rate: string | null }>(
      db,
      `SELECT c.id, c.code, c.pricing_type,
              (SELECT d.rate_per_kg FROM daily_rates d
                WHERE d.category_id = c.id AND d.effective_date <= $2
                ORDER BY d.effective_date DESC LIMIT 1) AS rate
         FROM categories c WHERE c.code = ANY($1::text[]) AND c.is_active`,
      [codes, dhakaToday(now)],
    );
    const unknown = codes.filter((c) => !categories.some((k) => k.code === c));
    if (unknown.length) throw AppError.validation(`Unknown categories: ${unknown.join(', ')}.`, { categoryCodes: unknown });
    const unpriced = categories.filter((c) => c.pricing_type === 'PER_KG' && c.rate === null).map((c) => c.code);
    if (unpriced.length) {
      throw AppError.validation(
        `Today's rate is not published yet for: ${unpriced.join(', ')}. Try again later or leave them out.`,
        { categoryCodes: unpriced },
      );
    }
    // The bands start at 2 kg (UNDER_5 means 2 to 5 kg), so every request meets the minimum;
    // electronics-only requests are exempt anyway.
    const expiresAt = bookableSlotEnd(input.slotDate, input.slot, now);

    const pickupId = await db.transaction(async (tx) => {
      const created = await one<{ id: string }>(
        tx,
        `INSERT INTO pickups (household_id, address_id, address_text, area, location, slot_date, slot, weight_band,
                              note, status, search_radius_m, requested_at, search_started_at, expires_at)
         SELECT $1, a.id, $3, a.area, a.location, $4, $5, $6, $7, 'REQUESTED', $8, $9, $9, $10
           FROM addresses a WHERE a.id = $2
         RETURNING id`,
        [
          household.id,
          address.id,
          [address.line, address.area, address.city].join(', '),
          input.slotDate,
          input.slot,
          input.weightBand,
          input.note ?? address.note,
          MATCHING.initialRadiusM,
          now,
          expiresAt,
        ],
      );
      await tx.query(`INSERT INTO pickup_items (pickup_id, category_id) SELECT $1, unnest($2::uuid[])`, [
        created!.id,
        categories.map((c) => c.id),
      ]);
      await this.store.recordEvent(tx, created!.id, null, 'REQUESTED', household);
      return created!.id;
    });

    await this.matching.announce(pickupId);
    return this.store.view(pickupId, household);
  }

  get(viewer: Viewer, pickupId: string): Promise<PickupDto> {
    return this.store.view(pickupId, viewer);
  }

  /** The household's own pickups, or the collector's assigned ones, newest first. */
  async listMine(viewer: Viewer, filter: keyof typeof LIST_FILTERS | undefined, limit: number, cursor?: string) {
    const statuses = filter ? LIST_FILTERS[filter] : null;
    let after: { at: string; id: string } | null = null;
    if (cursor) {
      const [at, id] = Buffer.from(cursor, 'base64url').toString().split('|');
      if (!at || !id || Number.isNaN(Date.parse(at))) throw AppError.validation('The cursor is not valid. Start from the first page.');
      after = { at, id };
    }
    const owner = viewer.role === 'HOUSEHOLD' ? 'household_id' : 'collector_id';
    const found = await rows<{ id: string; requested_at: Date }>(
      this.store.db,
      `SELECT id, requested_at FROM pickups
        WHERE ${owner} = $1
          AND ($2::pickup_status[] IS NULL OR status = ANY($2::pickup_status[]))
          AND ($3::timestamptz IS NULL OR (requested_at, id) < ($3::timestamptz, $4::uuid))
        ORDER BY requested_at DESC, id DESC
        LIMIT $5`,
      [viewer.id, statuses, after?.at ?? null, after?.id ?? null, limit + 1],
    );
    const page = found.slice(0, limit);
    const last = page.at(-1);
    return {
      items: await this.store.viewMany(page.map((p) => p.id), viewer),
      nextCursor:
        found.length > limit && last
          ? Buffer.from(`${last.requested_at.toISOString()}|${last.id}`).toString('base64url')
          : null,
    };
  }

  /** Household cancels while REQUESTED or ACCEPTED; admins cancel any active pickup. */
  async cancel(actor: Viewer, pickupId: string, reason?: string): Promise<PickupDto> {
    const now = this.store.now();
    const result = await this.store.db.transaction(async (tx) => {
      const p = await this.store.lockFor(tx, pickupId, actor);
      if (actor.role === 'COLLECTOR') throw AppError.forbidden('Collectors cannot cancel; release the request instead.');
      await this.store.transition(tx, p, 'CANCELLED', actor, { cancelled_at: now }, { reason: reason ?? null });
      const closed = await rows<{ id: string }>(
        tx,
        `UPDATE disputes SET status = 'RESOLVED', resolution = 'CANCEL', resolution_note = $2,
                resolved_by = $3, resolved_at = $4
          WHERE pickup_id = $1 AND status <> 'RESOLVED' RETURNING id`,
        [pickupId, reason ?? 'Pickup cancelled', actor.id, now],
      );
      return { p, closedDisputeIds: closed.map((d) => d.id) };
    });
    const { p, closedDisputeIds } = result;

    await this.store.forgetCode(pickupId);
    this.events.changed('pickup.cancelled', p, 'CANCELLED', now);
    if (p.status === 'REQUESTED') {
      const reached = await this.matching.collectorsAround(this.store.db, pickupId);
      this.events.requestTaken(pickupId, 'CANCELLED', reached.map((c) => c.userId));
    }
    if (closedDisputeIds.length) {
      const disputes = await this.store.disputeRows(this.store.db, `d.id = ANY($1::uuid[])`, [closedDisputeIds]);
      for (const d of disputes) this.events.dispute('dispute.resolved', d, p);
    }
    return this.store.view(pickupId, actor);
  }

  /** A presigned upload slot for an item photo (household) or a scale photo (collector, or admin). */
  async photoUploadSlot(actor: Viewer, pickupId: string, kind: 'ITEMS' | 'SCALE', contentType: PhotoContentType) {
    const p = await one<{ status: PickupStatus; household_id: string; collector_id: string | null; photos: number }>(
      this.store.db,
      `SELECT status, household_id, collector_id,
              (SELECT count(*)::int FROM pickup_photos WHERE pickup_id = p.id) AS photos
         FROM pickups p WHERE id = $1`,
      [pickupId],
    );
    const isOwner = p?.household_id === actor.id;
    const isAssigned = p?.collector_id === actor.id;
    if (!p || !(isOwner || isAssigned || actor.role === 'ADMIN')) throw AppError.notFound('That pickup was not found.');

    if (kind === 'ITEMS') {
      if (!isOwner) throw AppError.forbidden('Only the household adds item photos.');
      if (![...ACTIVE_PICKUP_STATUSES, 'COMPLETED'].includes(p.status)) {
        throw AppError.invalidState('Photos cannot be added to a cancelled or expired pickup.', { status: p.status });
      }
    } else {
      if (isOwner) throw AppError.forbidden('Only the collector or BhangariWala staff add scale photos.');
      const ok = actor.role === 'ADMIN' ? p.status === 'DISPUTED' : ['ARRIVED', 'DISPUTED'].includes(p.status);
      if (!ok) throw AppError.invalidState('A scale photo can be added only while weighing.', { status: p.status });
    }
    if (p.photos >= MAX_PHOTOS_PER_PICKUP) {
      throw AppError.validation(`A pickup can have up to ${MAX_PHOTOS_PER_PICKUP} photos.`);
    }

    const photoId = randomUUID();
    const key = `pickups/${pickupId}/${photoId}.${EXTENSIONS[contentType]}`;
    const now = this.store.now();
    await this.store.db.query(
      `INSERT INTO pickup_photos (id, pickup_id, kind, storage_key, uploaded_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [photoId, pickupId, kind, key, actor.id, now],
    );
    return {
      photoId,
      uploadUrl: await this.storage.uploadUrl(key, contentType, UPLOAD_URL_TTL_SEC),
      expiresAt: new Date(now.getTime() + UPLOAD_URL_TTL_SEC * 1000).toISOString(),
    };
  }

  /** One rating per completed pickup; keeps the collector's average up to date. */
  async rate(household: Viewer, pickupId: string, stars: number, comment?: string): Promise<void> {
    await this.store.db.transaction(async (tx) => {
      const p = await this.store.lockFor(tx, pickupId, household, false);
      if (p.status !== 'COMPLETED' || !p.collector_id) {
        throw AppError.invalidState('You can rate the collector after the pickup is completed.', { status: p.status });
      }
      const saved = await rows<{ pickup_id: string }>(
        tx,
        `INSERT INTO ratings (pickup_id, stars, comment, created_at) VALUES ($1, $2, $3, $4)
         ON CONFLICT (pickup_id) DO NOTHING RETURNING pickup_id`,
        [pickupId, stars, comment ?? null, this.store.now()],
      );
      if (saved.length === 0) throw AppError.invalidState('You already rated this pickup.');
      await tx.query(
        `UPDATE collector_profiles SET rating_avg = (
           SELECT round(avg(r.stars)::numeric, 1) FROM ratings r JOIN pickups p ON p.id = r.pickup_id
            WHERE p.collector_id = $1)
         WHERE user_id = $1`,
        [p.collector_id],
      );
    });
  }
}
