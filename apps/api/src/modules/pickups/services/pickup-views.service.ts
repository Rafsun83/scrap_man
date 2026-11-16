import { Inject, Injectable } from '@nestjs/common';
import { PICKUP_CODE_MAX_ATTEMPTS, type PickupStatus } from '@bw/shared';
import { CLOCK, type Clock } from '../../../common/clock.js';
import { AppError } from '../../../common/errors.js';
import type { Db } from '../../../common/sql.js';
import { dhakaToday } from '../../../common/time.js';
import { DOWNLOAD_URL_TTL_SEC, PHOTO_STORAGE } from '../../storage/storage.module.js';
import type { PhotoStorage } from '../../storage/types/photo-storage.type.js';
import type { DisputeDto } from '../dtos/dispute.dto.js';
import type { NearbyRequestDto, PayoutEstimateDto, PickupDto } from '../dtos/pickup.dto.js';
import { DisputesRepository } from '../repositories/disputes.repository.js';
import { PickupsRepository } from '../repositories/pickups.repository.js';
import type { DisputeRow, PickupRecord, Viewer } from '../types/pickup-record.types.js';
import { estimateUtil } from '../utils/estimate.util.js';
import { moneyUtil } from '../utils/money.util.js';
import { PickupCodeService } from './pickup-code.service.js';

/** Statuses in which the assigned collector sees the exact address and the household's phone. */
const COLLECTOR_SEES_ADDRESS: ReadonlySet<PickupStatus> = new Set([
  'ACCEPTED',
  'ARRIVED',
  'WEIGHED',
  'DISPUTED',
  'CONFIRMED',
  'COMPLETED',
]);

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const { num } = moneyUtil;

/** Loads pickup records and shapes them into what each viewer may see. */
@Injectable()
export class PickupViewsService {
  constructor(
    private readonly pickupsRepository: PickupsRepository,
    private readonly disputesRepository: DisputesRepository,
    private readonly pickupCodeService: PickupCodeService,
    @Inject(PHOTO_STORAGE) private readonly storage: PhotoStorage,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Full records for these pickups, keyed by id. */
  async load(ids: string[], db?: Db): Promise<Map<string, PickupRecord>> {
    const [records, disputes] = await Promise.all([
      this.pickupsRepository.loadRecords(ids, dhakaToday(this.clock.now()), db),
      this.disputesRepository.byPickupIds(ids, db),
    ]);
    const out = new Map<string, PickupRecord>();
    for (const [id, rec] of records) out.set(id, { ...rec, disputes: disputes.filter((d) => d.pickup_id === id) });
    return out;
  }

  async loadOne(id: string, db?: Db): Promise<PickupRecord | null> {
    return (await this.load([id], db)).get(id) ?? null;
  }

  /** The pickup as this viewer may see it; NOT_FOUND for anyone else. */
  async view(id: string, viewer: Viewer): Promise<PickupDto> {
    const rec = await this.loadOne(id);
    if (!rec || !this.canSee(rec, viewer)) throw AppError.notFound('That pickup was not found.');
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

  /** The contract's Pickup for one viewer, with the household's code and presigned photo links. */
  async toDto(rec: PickupRecord, viewer: Viewer): Promise<PickupDto> {
    const showCode = viewer.role === 'HOUSEHOLD' && rec.row.household_id === viewer.id && rec.row.status === 'ACCEPTED';
    const [pickupCode, photoUrls] = await Promise.all([
      showCode ? this.pickupCodeService.forHousehold(rec.row.id) : Promise.resolve(null),
      this.photoUrls(rec),
    ]);
    return this.shape(rec, viewer, pickupCode, photoUrls);
  }

  /** The contract's NearbyRequest: area and distance only, never the address or phone. */
  toNearbyRequest(rec: PickupRecord, distanceM: number): NearbyRequestDto {
    return {
      id: rec.row.id,
      area: rec.row.area,
      distanceM,
      categoryCodes: [...rec.items].sort((a, b) => a.sort_order - b.sort_order).map((i) => i.code),
      weightBand: rec.row.weight_band,
      slotDate: rec.row.slot_date,
      slot: rec.row.slot,
      hasPhoto: rec.photos.some((p) => p.kind === 'ITEMS'),
      estimate: this.estimate(rec),
      requestedAt: rec.row.requested_at.toISOString(),
      expiresAt: rec.row.expires_at.toISOString(),
    };
  }

  toDisputeDto(d: DisputeRow): DisputeDto {
    return {
      id: d.id,
      pickupId: d.pickup_id,
      displayNo: this.displayNo(d.display_no),
      type: d.type,
      status: d.status,
      raisedBy: d.raised_by,
      reason: d.reason,
      photoIds: d.photo_ids,
      outcome: d.resolution,
      resolutionNote: d.resolution_note,
      createdAt: d.created_at.toISOString(),
      resolvedAt: iso(d.resolved_at),
    };
  }

  displayNo(n: string | number): string {
    return `BW-${n}`;
  }

  /** Who may open a pickup at all: its household, its assigned collector, or an admin. */
  private canSee(rec: PickupRecord, viewer: Viewer): boolean {
    const { row } = rec;
    if (viewer.role === 'ADMIN') return true;
    if (viewer.role === 'HOUSEHOLD') return row.household_id === viewer.id;
    return row.collector_id === viewer.id;
  }

  /** Rough payout range: locked rates after accept, today's rates before. */
  private estimate(rec: PickupRecord): PayoutEstimateDto | null {
    const locked = rec.row.collector_id !== null && rec.row.accepted_at !== null;
    const rates = rec.items
      .filter((i) => i.pricing_type === 'PER_KG')
      .map((i) => num(locked ? i.rate_snapshot : i.current_rate))
      .filter((r): r is number => r !== null);
    return estimateUtil.payout(rec.row.weight_band, rates);
  }

  /** Presigned download links for every photo on the record. */
  private async photoUrls(rec: PickupRecord): Promise<Map<string, string>> {
    const urls = await Promise.all(rec.photos.map((p) => this.storage.downloadUrl(p.storage_key, DOWNLOAD_URL_TTL_SEC)));
    return new Map(rec.photos.map((p, i) => [p.id, urls[i]]));
  }

  private shape(rec: PickupRecord, viewer: Viewer, pickupCode: string | null, photoUrls: ReadonlyMap<string, string>): PickupDto {
    const { row } = rec;
    const isOwner = viewer.role === 'HOUSEHOLD' && row.household_id === viewer.id;
    const isAssigned = viewer.role === 'COLLECTOR' && row.collector_id === viewer.id;
    const isAdmin = viewer.role === 'ADMIN';
    const collectorSeesPrivate = isAssigned && COLLECTOR_SEES_ADDRESS.has(row.status);
    const seesAddress = isOwner || isAdmin || collectorSeesPrivate;

    const versions = [...new Set(rec.weighLines.map((l) => l.version))].sort((a, b) => a - b);
    const linesOf = (v: number) =>
      rec.weighLines
        .filter((l) => l.version === v)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((l) => ({ categoryCode: l.code, kg: Number(l.kg), rate: num(l.rate), amount: Number(l.amount) }));
    const weighRounds = versions.map((v) => {
      const lines = linesOf(v);
      const first = rec.weighLines.find((l) => l.version === v)!;
      const scale = rec.photos.find((p) => p.kind === 'SCALE' && p.weigh_version === v);
      const tenths = lines.reduce((s, l) => s + Math.round(l.kg * 10), 0);
      const paisa = lines.reduce((s, l) => s + Math.round(l.amount * 100), 0);
      return {
        version: v,
        lines,
        totalKg: tenths / 10,
        totalAmount: paisa / 100,
        scalePhotoId: scale?.id ?? null,
        weighedBy: first.created_by_role === 'ADMIN' ? ('ADMIN' as const) : ('COLLECTOR' as const),
        createdAt: first.created_at.toISOString(),
      };
    });
    const latest = versions.at(-1);
    const sortedItems = [...rec.items].sort((a, b) => a.sort_order - b.sort_order);
    const ratesLocked = row.collector_id !== null && row.accepted_at !== null && (isOwner || isAssigned || isAdmin);
    const openDispute = rec.disputes.find((d) => d.status !== 'RESOLVED');

    return {
      id: row.id,
      displayNo: this.displayNo(row.display_no),
      status: row.status,
      slotDate: row.slot_date,
      slot: row.slot,
      weightBand: row.weight_band,
      categoryCodes: sortedItems.map((i) => i.code),
      area: row.area,
      estimate: this.estimate(rec),
      address: seesAddress ? { text: row.address_text, lat: row.lat, lng: row.lng, note: row.note } : null,
      household: {
        id: row.household_id,
        name: row.household_name,
        phone: isAdmin || collectorSeesPrivate ? row.household_phone : null,
      },
      collector: row.collector_id
        ? {
            id: row.collector_id,
            name: row.collector_name,
            rating: num(row.collector_rating),
            phone: isOwner || isAdmin || isAssigned ? row.collector_phone : null,
          }
        : null,
      pickupCode: isOwner && row.status === 'ACCEPTED' ? pickupCode : null,
      codeLocked: row.code_attempts >= PICKUP_CODE_MAX_ATTEMPTS,
      lines: latest === undefined ? [] : linesOf(latest),
      weighVersion: latest ?? null,
      weighRounds,
      photos: rec.photos
        .filter((p) => photoUrls.has(p.id))
        .map((p) => ({
          id: p.id,
          kind: p.kind,
          weighVersion: p.weigh_version,
          url: photoUrls.get(p.id)!,
          createdAt: p.created_at.toISOString(),
        })),
      totalKg: num(row.total_kg),
      totalAmount: num(row.total_amount),
      paymentMethod: row.payment_method,
      walletNumber: isOwner || isAssigned || isAdmin ? row.wallet_number : null,
      payment: rec.payment
        ? {
            method: rec.payment.method,
            amount: Number(rec.payment.amount),
            walletNumber: rec.payment.wallet_number,
            trxId: rec.payment.trx_id,
            status: rec.payment.status,
            paidAt: rec.payment.paid_at.toISOString(),
          }
        : null,
      openDispute: openDispute ? this.toDisputeDto(openDispute) : null,
      searchRadiusM: row.search_radius_m,
      requestedAt: row.requested_at.toISOString(),
      acceptedAt: iso(row.accepted_at),
      arrivedAt: iso(row.arrived_at),
      weighedAt: iso(row.weighed_at),
      confirmedAt: iso(row.confirmed_at),
      completedAt: iso(row.completed_at),
      cancelledAt: iso(row.cancelled_at),
      expiresAt: row.expires_at.toISOString(),
      collectorLocation:
        (isOwner || isAdmin) && row.status === 'ACCEPTED' && row.collector_lat !== null && row.collector_lng !== null
          ? { lat: Number(row.collector_lat), lng: Number(row.collector_lng), at: iso(row.collector_seen_at) ?? iso(row.accepted_at)! }
          : null,
      rating:
        (isOwner || isAssigned || isAdmin) && row.rating_stars !== null
          ? { stars: Number(row.rating_stars), comment: row.rating_comment, createdAt: row.rated_at!.toISOString() }
          : null,
      lockedRates: ratesLocked ? sortedItems.map((i) => ({ categoryCode: i.code, rate: num(i.rate_snapshot) })) : null,
    };
  }
}
