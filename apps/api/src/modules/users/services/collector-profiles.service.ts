import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../../../common/clock.js';
import { AppError } from '../../../common/errors.js';
import type { LatLng } from '../../../common/geo.js';
import type { Db } from '../../../common/sql.js';
import type { VerificationStatus } from '../enums/verification-status.enum.js';
import {
  CollectorProfilesRepository,
  type CollectorAvailabilityRow,
} from '../repositories/collector-profiles.repository.js';
import type {
  CollectorApplication,
  CollectorProfileRow,
  CollectorWorkChanges,
} from '../types/collector-application.types.js';

/** Collector profiles: the application and its decision, availability, last location and rating. */
@Injectable()
export class CollectorProfilesService {
  constructor(
    private readonly collectorProfilesRepository: CollectorProfilesRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** The collector's profile with name and phone; NOT_FOUND until they have signed up. */
  async requireProfile(userId: string): Promise<CollectorProfileRow> {
    const profile = await this.collectorProfilesRepository.findWithUser(userId);
    if (!profile) throw AppError.notFound('You have not applied as a collector yet. Fill in the sign-up form first.');
    return profile;
  }

  /** Saves the application as PENDING; INVALID_STATE while one is PENDING or already APPROVED. */
  async submitApplication(application: CollectorApplication): Promise<void> {
    if (await this.collectorProfilesRepository.submitApplication(application, this.clock.now())) return;
    const existing = await this.collectorProfilesRepository.findAvailability(application.userId);
    throw AppError.invalidState(
      existing?.verification_status === 'APPROVED'
        ? 'Your collector account is already approved.'
        : 'Your application is already being checked. You will get an SMS when it is decided.',
      { verificationStatus: existing?.verification_status ?? null },
    );
  }

  async updateWork(userId: string, changes: CollectorWorkChanges): Promise<void> {
    if (!(await this.collectorProfilesRepository.updateWork(userId, changes, this.clock.now()))) {
      throw AppError.notFound('You have not applied as a collector yet. Fill in the sign-up form first.');
    }
  }

  /** An admin approves or rejects a PENDING application. */
  async decide(userId: string, decision: Exclude<VerificationStatus, 'PENDING'>, note: string | null, adminId: string, now: Date): Promise<void> {
    if (await this.collectorProfilesRepository.decide(userId, decision, note, adminId, now)) return;
    const existing = await this.collectorProfilesRepository.findAvailability(userId);
    if (!existing) throw AppError.notFound('This user has not applied as a collector.');
    throw AppError.invalidState(`This application was already decided (${existing.verification_status}).`, {
      verificationStatus: existing.verification_status,
    });
  }

  page(status: VerificationStatus | null, after: { at: string; id: string } | null, limit: number): Promise<CollectorProfileRow[]> {
    return this.collectorProfilesRepository.page(status, after, limit);
  }

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
