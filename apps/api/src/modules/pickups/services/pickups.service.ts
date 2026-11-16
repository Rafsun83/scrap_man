import { Inject, Injectable } from '@nestjs/common';
import { ACTIVE_PICKUP_STATUSES, MATCHING, type PickupStatus } from '@bw/shared';
import { randomUUID } from 'node:crypto';
import { CLOCK, type Clock } from '../../../common/clock.js';
import { AppError } from '../../../common/errors.js';
import { dhakaToday } from '../../../common/time.js';
import { PHOTO_STORAGE, UPLOAD_URL_TTL_SEC } from '../../storage/storage.module.js';
import type { PhotoStorage } from '../../storage/types/photo-storage.type.js';
import { CollectorProfilesService } from '../../users/services/collector-profiles.service.js';
import type { CreatePickupDto } from '../dtos/create-pickup.dto.js';
import type { ListMyPickupsDto } from '../dtos/list-my-pickups.dto.js';
import type { PhotoContentType, PhotoUploadSlotDto } from '../dtos/photo-upload.dto.js';
import type { PickupDto, PickupPageDto, PickupSummaryDto } from '../dtos/pickup.dto.js';
import { DisputesRepository } from '../repositories/disputes.repository.js';
import { PhotosRepository } from '../repositories/photos.repository.js';
import { PickupsRepository } from '../repositories/pickups.repository.js';
import type { Viewer } from '../types/pickup-record.types.js';
import { slotUtil } from '../utils/slot.util.js';
import { MatchingService } from './matching.service.js';
import { PickupCodeService } from './pickup-code.service.js';
import { PickupEventsService } from './pickup-events.service.js';
import { PickupStateService } from './pickup-state.service.js';
import { PickupViewsService } from './pickup-views.service.js';

const MAX_PHOTOS_PER_PICKUP = 30;
const EXTENSIONS: Record<PhotoContentType, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const LIST_FILTERS: Record<NonNullable<ListMyPickupsDto['status']>, readonly PickupStatus[]> = {
  ACTIVE: ACTIVE_PICKUP_STATUSES,
  COMPLETED: ['COMPLETED'],
  CANCELLED: ['CANCELLED', 'EXPIRED'],
  PAST: ['COMPLETED', 'CANCELLED', 'EXPIRED'],
};

/** Creating, reading, listing and cancelling pickups, photo upload slots and ratings. */
@Injectable()
export class PickupsService {
  constructor(
    private readonly pickupsRepository: PickupsRepository,
    private readonly photosRepository: PhotosRepository,
    private readonly disputesRepository: DisputesRepository,
    private readonly pickupStateService: PickupStateService,
    private readonly pickupCodeService: PickupCodeService,
    private readonly pickupViewsService: PickupViewsService,
    private readonly pickupEventsService: PickupEventsService,
    private readonly matchingService: MatchingService,
    private readonly collectorProfilesService: CollectorProfilesService,
    @Inject(PHOTO_STORAGE) private readonly storage: PhotoStorage,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async create(household: Viewer, input: CreatePickupDto): Promise<PickupDto> {
    const now = this.clock.now();
    const address = await this.pickupsRepository.findHouseholdAddress(household.id, input.addressId);
    if (!address) throw AppError.notFound('That address was not found. Pick one of your saved addresses.');

    const codes = [...new Set(input.categoryCodes)];
    const categories = await this.pickupsRepository.categoriesWithRates(codes, dhakaToday(now));
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
    const expiresAt = slotUtil.bookableSlotEnd(input.slotDate, input.slot, now);

    const pickupId = await this.pickupsRepository.transaction(async (tx) => {
      const id = await this.pickupsRepository.insertRequest(tx, {
        householdId: household.id,
        addressId: address.id,
        addressText: [address.line, address.area, address.city].join(', '),
        slotDate: input.slotDate,
        slot: input.slot,
        weightBand: input.weightBand,
        note: input.note ?? address.note,
        searchRadiusM: MATCHING.initialRadiusM,
        now,
        expiresAt,
      });
      await this.pickupsRepository.insertItems(tx, id, categories.map((c) => c.id));
      await this.pickupStateService.recordEvent(tx, id, null, 'REQUESTED', household);
      return id;
    });

    await this.matchingService.announce(pickupId);
    return this.pickupViewsService.view(pickupId, household);
  }

  get(viewer: Viewer, pickupId: string): Promise<PickupDto> {
    return this.pickupViewsService.view(pickupId, viewer);
  }

  /** The household's own pickups, or the collector's assigned ones, newest first. */
  async listMine(viewer: Viewer, query: ListMyPickupsDto): Promise<PickupPageDto> {
    const statuses = query.status ? LIST_FILTERS[query.status] : null;
    let after: { at: string; id: string } | null = null;
    if (query.cursor) {
      const [at, id] = Buffer.from(query.cursor, 'base64url').toString().split('|');
      if (!at || !id || Number.isNaN(Date.parse(at))) throw AppError.validation('The cursor is not valid. Start from the first page.');
      after = { at, id };
    }
    const owner = viewer.role === 'HOUSEHOLD' ? 'household_id' : 'collector_id';
    const found = await this.pickupsRepository.pageIds(owner, viewer.id, statuses, after, query.limit + 1);
    const page = found.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: await this.pickupViewsService.viewMany(page.map((p) => p.id), viewer),
      nextCursor:
        found.length > query.limit && last
          ? Buffer.from(`${last.requested_at.toISOString()}|${last.id}`).toString('base64url')
          : null,
    };
  }

  /** H11 totals: completed pickups, their final kg and the taka paid. */
  async summary(household: Viewer): Promise<PickupSummaryDto> {
    const row = await this.pickupsRepository.completedTotals(household.id);
    return {
      completedCount: Number(row?.completed_count ?? 0),
      totalKg: Number(row?.total_kg ?? 0),
      totalAmount: Number(row?.total_amount ?? 0),
    };
  }

  /** Household cancels while REQUESTED or ACCEPTED; admins cancel any active pickup. */
  async cancel(actor: Viewer, pickupId: string, reason?: string): Promise<PickupDto> {
    const now = this.clock.now();
    const { p, closedDisputeIds } = await this.pickupsRepository.transaction(async (tx) => {
      const p = await this.pickupStateService.lockFor(tx, pickupId, actor);
      if (actor.role === 'COLLECTOR') throw AppError.forbidden('Collectors cannot cancel; release the request instead.');
      await this.pickupStateService.transition(tx, p, 'CANCELLED', actor, { cancelled_at: now }, { reason: reason ?? null });
      const closedDisputeIds = await this.disputesRepository.resolveOpenAsCancelled(
        tx,
        pickupId,
        reason ?? 'Pickup cancelled',
        actor.id,
        now,
      );
      return { p, closedDisputeIds };
    });

    await this.pickupCodeService.forget(pickupId);
    this.pickupEventsService.changed('pickup.cancelled', p, 'CANCELLED', now);
    if (p.status === 'REQUESTED') {
      const reached = await this.matchingService.collectorsAround(pickupId);
      this.pickupEventsService.requestTaken(pickupId, 'CANCELLED', reached.map((c) => c.userId));
    }
    if (closedDisputeIds.length) {
      const disputes = await this.disputesRepository.byIds(closedDisputeIds);
      for (const d of disputes) this.pickupEventsService.dispute('dispute.resolved', d, p);
    }
    return this.pickupViewsService.view(pickupId, actor);
  }

  /** A presigned upload slot for an item photo (household) or a scale photo (collector, or admin). */
  async photoUploadSlot(actor: Viewer, pickupId: string, kind: 'ITEMS' | 'SCALE', contentType: PhotoContentType): Promise<PhotoUploadSlotDto> {
    const p = await this.photosRepository.uploadFacts(pickupId);
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
    const now = this.clock.now();
    await this.photosRepository.insert(photoId, pickupId, kind, key, actor.id, now);
    return {
      photoId,
      uploadUrl: await this.storage.uploadUrl(key, contentType, UPLOAD_URL_TTL_SEC),
      expiresAt: new Date(now.getTime() + UPLOAD_URL_TTL_SEC * 1000).toISOString(),
    };
  }

  /** One rating per completed pickup; keeps the collector's average up to date. */
  async rate(household: Viewer, pickupId: string, stars: number, comment?: string): Promise<void> {
    await this.pickupsRepository.transaction(async (tx) => {
      const p = await this.pickupStateService.lockFor(tx, pickupId, household, false);
      if (p.status !== 'COMPLETED' || !p.collector_id) {
        throw AppError.invalidState('You can rate the collector after the pickup is completed.', { status: p.status });
      }
      const saved = await this.pickupsRepository.insertRating(tx, pickupId, stars, comment ?? null, this.clock.now());
      if (!saved) throw AppError.invalidState('You already rated this pickup.');
      await this.collectorProfilesService.refreshRating(tx, p.collector_id);
    });
  }
}
