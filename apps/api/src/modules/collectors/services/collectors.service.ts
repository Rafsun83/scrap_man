import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { VehicleType, WorkArea } from '@bw/shared';
import { CLOCK, type Clock } from '../../../common/clock.js';
import { AppError } from '../../../common/errors.js';
import { CollectorLedgerService } from '../../pickups/services/collector-ledger.service.js';
import { DOWNLOAD_URL_TTL_SEC, PHOTO_STORAGE, UPLOAD_URL_TTL_SEC } from '../../storage/storage.module.js';
import type { PhotoStorage } from '../../storage/types/photo-storage.type.js';
import { CollectorProfilesService } from '../../users/services/collector-profiles.service.js';
import { UsersService } from '../../users/services/users.service.js';
import type { CollectorProfileRow } from '../../users/types/collector-application.types.js';
import type { CollectorProfileDto } from '../dtos/collector-profile.dto.js';
import type { CollectorSignupDto } from '../dtos/collector-signup.dto.js';
import type { SelfieContentType, UploadSlotDto } from '../dtos/selfie-upload.dto.js';
import type { UpdateCollectorProfileDto } from '../dtos/update-collector-profile.dto.js';
import { CollectorSelfiesRepository } from '../repositories/collector-selfies.repository.js';

/** A collector can upload this many selfies in total (retakes included). */
const MAX_SELFIES_PER_USER = 20;
const EXTENSIONS: Record<SelfieContentType, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Collector sign-up (C6), the application's status (C7) and the collector's own profile (C11). */
@Injectable()
export class CollectorsService {
  constructor(
    private readonly collectorSelfiesRepository: CollectorSelfiesRepository,
    private readonly collectorProfilesService: CollectorProfilesService,
    private readonly usersService: UsersService,
    private readonly collectorLedgerService: CollectorLedgerService,
    @Inject(PHOTO_STORAGE) private readonly storage: PhotoStorage,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** A presigned upload slot for a selfie, in private storage. */
  async selfieUploadSlot(userId: string, contentType: SelfieContentType): Promise<UploadSlotDto> {
    if ((await this.collectorSelfiesRepository.countByUser(userId)) >= MAX_SELFIES_PER_USER) {
      throw AppError.validation('Too many selfies uploaded. Call BhangariWala support to finish signing up.');
    }
    const photoId = randomUUID();
    const key = `selfies/${userId}/${photoId}.${EXTENSIONS[contentType]}`;
    const now = this.clock.now();
    await this.collectorSelfiesRepository.insert(photoId, userId, key, now);
    return {
      photoId,
      uploadUrl: await this.storage.uploadUrl(key, contentType, UPLOAD_URL_TTL_SEC),
      expiresAt: new Date(now.getTime() + UPLOAD_URL_TTL_SEC * 1000).toISOString(),
    };
  }

  /** Saves the application as PENDING (again after a rejection) and the account name. */
  async signUp(userId: string, input: CollectorSignupDto): Promise<CollectorProfileDto> {
    const selfie = await this.collectorSelfiesRepository.findOfUser(input.selfiePhotoId, userId);
    if (!selfie) throw AppError.validation('Take your selfie again and upload it before applying.');
    if (!(await this.storage.exists(selfie.storageKey))) {
      throw AppError.validation('Your selfie has not finished uploading. Upload it again, then apply.');
    }
    await this.collectorProfilesService.submitApplication({
      userId,
      nidNumber: input.nidNumber,
      selfieId: selfie.id,
      workAreas: input.workAreas,
      vehicleType: input.vehicleType,
      hasScale: input.hasScale,
    });
    await this.usersService.updateProfile(userId, { name: input.name });
    return this.profile(userId);
  }

  /** The collector's own profile; NOT_FOUND before sign-up. */
  async profile(userId: string): Promise<CollectorProfileDto> {
    const row = await this.collectorProfilesService.requireProfile(userId);
    return (await this.toDtos([row]))[0];
  }

  async updateProfile(userId: string, changes: UpdateCollectorProfileDto): Promise<CollectorProfileDto> {
    await this.collectorProfilesService.updateWork(userId, changes);
    return this.profile(userId);
  }

  /** The contract's CollectorProfile for each row, with selfie links and 30-day activity. */
  async toDtos(rows: CollectorProfileRow[]): Promise<CollectorProfileDto[]> {
    const selfies = await this.collectorSelfiesRepository.findByIds(
      rows.map((r) => r.selfie_id).filter((id): id is string => id !== null),
    );
    const keys = new Map(selfies.map((s) => [s.id, s.storageKey]));
    return Promise.all(
      rows.map(async (row) => {
        const key = row.selfie_id ? keys.get(row.selfie_id) : undefined;
        const [selfieUrl, activity] = await Promise.all([
          key ? this.storage.downloadUrl(key, DOWNLOAD_URL_TTL_SEC) : Promise.resolve(null),
          this.collectorLedgerService.recentActivity(row.user_id),
        ]);
        return {
          userId: row.user_id,
          name: row.name,
          phone: row.phone,
          nidNumberMasked: this.maskNid(row.nid_number),
          nidVerified: row.nid_verified,
          selfieUrl,
          workAreas: row.work_areas as WorkArea[],
          vehicleType: row.vehicle_type as VehicleType,
          hasScale: row.has_scale,
          verificationStatus: row.verification_status,
          verificationNote: row.verification_note,
          submittedAt: row.submitted_at.toISOString(),
          decidedAt: row.decided_at ? row.decided_at.toISOString() : null,
          isOnline: row.is_online,
          ratingAvg: row.rating_avg === null ? null : Number(row.rating_avg),
          ...activity,
        };
      }),
    );
  }

  /** First 2 and last 4 digits, the rest as X, grouped like the prototype: "19XX XXX 4821". */
  private maskNid(nid: string): string {
    const masked = nid.slice(0, 2) + 'X'.repeat(nid.length - 6) + nid.slice(-4);
    return masked.replace(/^(.{4})(.*)(.{4})$/, (_, a: string, mid: string, z: string) => [a, mid, z].filter(Boolean).join(' '));
  }
}
