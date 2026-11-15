import { Inject, Injectable, Logger } from '@nestjs/common';
import { MATCHING, PICKUP_CODE_MAX_ATTEMPTS } from '@bw/shared';
import { CLOCK, type Clock } from '../../../common/clock.js';
import { AppError } from '../../../common/errors.js';
import type { Db } from '../../../common/sql.js';
import { dhakaToday } from '../../../common/time.js';
import { CollectorProfilesService } from '../../users/services/collector-profiles.service.js';
import type { NearbyRequestDto, PickupDto } from '../dtos/pickup.dto.js';
import { MatchingRepository, type CollectorDistance } from '../repositories/matching.repository.js';
import { PickupsRepository } from '../repositories/pickups.repository.js';
import type { PickupRecord, Viewer } from '../types/pickup-record.types.js';
import { PickupCodeService } from './pickup-code.service.js';
import { PickupEventsService } from './pickup-events.service.js';
import { PickupStateService } from './pickup-state.service.js';
import { PickupViewsService } from './pickup-views.service.js';

/** Finding collectors for a request, the nearby list, accept / release, and the time-based sweeps. */
@Injectable()
export class MatchingService {
  private readonly logger = new Logger('MatchingJobs');

  constructor(
    private readonly matchingRepository: MatchingRepository,
    private readonly pickupsRepository: PickupsRepository,
    private readonly pickupStateService: PickupStateService,
    private readonly pickupCodeService: PickupCodeService,
    private readonly pickupViewsService: PickupViewsService,
    private readonly pickupEventsService: PickupEventsService,
    private readonly collectorProfilesService: CollectorProfilesService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private staleBefore(): Date {
    return new Date(this.clock.now().getTime() - MATCHING.onlineStaleAfterMs);
  }

  /**
   * Online, approved, active collectors inside the pickup's current radius, with their distance.
   * `outsideM` skips those already reached at a smaller radius (used after widening).
   */
  collectorsAround(pickupId: string, opts: { outsideM?: number; exclude?: string[] } = {}, db?: Db): Promise<CollectorDistance[]> {
    return this.matchingRepository.collectorsAround(pickupId, this.staleBefore(), opts.outsideM ?? null, opts.exclude ?? [], db);
  }

  /** Sends request.created to the collectors who can now see this request. */
  async announce(pickupId: string, opts: { outsideM?: number; exclude?: string[] } = {}): Promise<number> {
    const [rec, collectors] = await Promise.all([
      this.pickupViewsService.loadOne(pickupId),
      this.collectorsAround(pickupId, opts),
    ]);
    if (!rec || rec.row.status !== 'REQUESTED') return 0;
    this.pickupEventsService.requestCreated(rec, collectors);
    return collectors.length;
  }

  /** Open requests whose current radius reaches this point, nearest first. */
  async nearby(collector: Viewer, lat: number, lng: number): Promise<NearbyRequestDto[]> {
    await this.collectorProfilesService.requireApproved(collector.id);
    const found = await this.matchingRepository.nearbyRequests(lat, lng, this.clock.now());
    const records = await this.pickupViewsService.load(found.map((f) => f.id));
    return found
      .map((f) => ({ rec: records.get(f.id), distance: f.distance_m }))
      .filter((x): x is { rec: PickupRecord; distance: number } => x.rec !== undefined)
      .map((x) => this.pickupViewsService.toNearbyRequest(x.rec, x.distance));
  }

  /**
   * First accept wins: one UPDATE that only matches while the request is still REQUESTED,
   * unexpired and within reach of the collector's last location. Rates are copied onto the
   * pickup and a pickup code is created in the same transaction.
   */
  async accept(collector: Viewer, pickupId: string): Promise<PickupDto> {
    const profile = await this.collectorProfilesService.requireApproved(collector.id);
    if (!profile.is_online || !profile.has_location || !profile.last_seen_at || profile.last_seen_at < this.staleBefore()) {
      throw AppError.outOfRange('Go online and share your location before accepting a request.');
    }
    const now = this.clock.now();
    const { code, hash } = this.pickupCodeService.newCode(pickupId);

    const outcome = await this.pickupsRepository.transaction(async (tx) => {
      const won = await this.matchingRepository.acceptIfOpen(tx, pickupId, collector.id, now, hash);
      if (!won) return this.whyNotAccepted(tx, pickupId, collector.id, now);

      await this.pickupStateService.recordEvent(tx, pickupId, 'REQUESTED', 'ACCEPTED', collector);
      await this.pickupsRepository.snapshotRates(tx, pickupId, dhakaToday(now));
      return 'ACCEPTED' as const;
    });
    if (outcome !== 'ACCEPTED') throw outcome;

    await this.pickupCodeService.remember(pickupId, code);
    const rec = (await this.pickupViewsService.loadOne(pickupId))!;
    this.pickupEventsService.changed('pickup.accepted', rec.row, 'ACCEPTED', now);
    const others = await this.collectorsAround(pickupId, { exclude: [collector.id] });
    this.pickupEventsService.requestTaken(pickupId, 'ACCEPTED', others.map((c) => c.userId));
    return this.pickupViewsService.toDto(rec, collector);
  }

  /** Explains a lost accept with the contract's error codes. */
  private async whyNotAccepted(db: Db, pickupId: string, collectorId: string, now: Date): Promise<AppError> {
    const p = await this.matchingRepository.acceptFailureFacts(db, pickupId, collectorId);
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
    const now = this.clock.now();
    const released = await this.pickupsRepository.transaction(async (tx) => {
      const p = await this.pickupStateService.lockFor(tx, pickupId, collector, false);
      if (p.status === 'ACCEPTED' && p.code_attempts >= PICKUP_CODE_MAX_ATTEMPTS) throw AppError.codeLocked();
      await this.pickupStateService.transition(
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
      await this.pickupsRepository.clearRates(tx, pickupId);
      return p;
    });
    await this.pickupCodeService.forget(pickupId);
    this.pickupEventsService.changed('pickup.released', { ...released, collector_id: null }, 'REQUESTED', now, [collector.id]);
    await this.announce(pickupId, { exclude: [collector.id] });
  }

  /**
   * Widening: a request still at 1 km 5 minutes after matching started goes to 3 km, and the
   * newly reached collectors hear about it. One conditional UPDATE, so several API processes never double-apply.
   */
  async widenDue(now: Date): Promise<string[]> {
    const cutoff = new Date(now.getTime() - MATCHING.widenAfterMs);
    const widened = await this.pickupsRepository.transaction(async (tx) => {
      const found = await this.matchingRepository.widenDue(tx, MATCHING.widenedRadiusM, cutoff, now);
      await this.pickupsRepository.insertSystemEvents(
        tx,
        found.map((p) => p.id),
        'REQUESTED',
        'REQUESTED',
        { searchRadiusM: MATCHING.widenedRadiusM },
        now,
      );
      return found;
    });
    for (const p of widened) {
      await this.announce(p.id, { outsideM: MATCHING.initialRadiusM });
    }
    if (widened.length) this.logger.log(`Widened ${widened.length} request(s) to ${MATCHING.widenedRadiusM} m`);
    return widened.map((p) => p.id);
  }

  /** Expiry: a request nobody accepted expires at the end of its booked slot. */
  async expireDue(now: Date): Promise<string[]> {
    const expired = await this.pickupsRepository.transaction(async (tx) => {
      const found = await this.matchingRepository.expireDue(tx, now);
      await this.pickupsRepository.insertSystemEvents(tx, found.map((p) => p.id), 'REQUESTED', 'EXPIRED', null, now);
      return found;
    });
    for (const p of expired) {
      this.pickupEventsService.changed('request.expired', p, 'EXPIRED', now);
      const reached = await this.collectorsAround(p.id);
      this.pickupEventsService.requestTaken(p.id, 'EXPIRED', reached.map((c) => c.userId));
    }
    if (expired.length) this.logger.log(`Expired ${expired.length} request(s)`);
    return expired.map((p) => p.id);
  }
}
