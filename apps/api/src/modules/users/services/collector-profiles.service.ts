import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../../../common/clock.js';
import { AppError } from '../../../common/errors.js';
import type { LatLng } from '../../../common/geo.js';
import type { Db } from '../../../common/sql.js';
import {
  CollectorProfilesRepository,
  type CollectorAvailabilityRow,
} from '../repositories/collector-profiles.repository.js';

/** Collector availability: approval, online state, last location and rating. */
@Injectable()
export class CollectorProfilesService {
  constructor(
    private readonly collectorProfilesRepository: CollectorProfilesRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** The collector's availability; NOT_APPROVED until an admin approves the profile. */
  async requireApproved(userId: string): Promise<CollectorAvailabilityRow> {
    const profile = await this.collectorProfilesRepository.findAvailability(userId);
    if (!profile || profile.verification_status !== 'APPROVED') throw AppError.notApproved();
    return profile;
  }

  /** Going online needs a location; going offline may send one. */
  async setAvailability(userId: string, online: boolean, location?: LatLng): Promise<void> {
    await this.requireApproved(userId);
    if (online && !location) throw AppError.validation('Share your location to go online.');
    const now = this.clock.now();
    if (location) await this.collectorProfilesRepository.setOnlineAt(userId, online, location, now);
    else await this.collectorProfilesRepository.setOnline(userId, online, now);
  }

  async saveLocation(userId: string, location: LatLng, now: Date): Promise<void> {
    await this.requireApproved(userId);
    await this.collectorProfilesRepository.saveLocation(userId, location, now);
  }

  /** Recomputes the collector's average rating inside the caller's transaction. */
  refreshRating(db: Db, userId: string): Promise<void> {
    return this.collectorProfilesRepository.refreshRating(db, userId);
  }
}
