import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { PickupStatus } from '@bw/shared';
import { one, rows, type Db } from '../../../common/sql.js';

export interface PhotoUploadFacts {
  status: PickupStatus;
  household_id: string;
  collector_id: string | null;
  photos: number;
}

export interface ScalePhotoRow {
  storage_key: string;
  kind: string;
  uploaded_by: string;
  weigh_version: number | null;
}

/** pickup_photos: upload slots, scale photos claimed by a weigh round, and dispute evidence. */
@Injectable()
export class PhotosRepository {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** The pickup's status, people and photo count; null when the pickup does not exist. */
  uploadFacts(pickupId: string): Promise<PhotoUploadFacts | null> {
    return one<PhotoUploadFacts>(
      this.db,
      `SELECT status, household_id, collector_id,
              (SELECT count(*)::int FROM pickup_photos WHERE pickup_id = p.id) AS photos
         FROM pickups p WHERE id = $1`,
      [pickupId],
    );
  }

  async insert(id: string, pickupId: string, kind: 'ITEMS' | 'SCALE', storageKey: string, uploadedBy: string, at: Date): Promise<void> {
    await this.db.query(
      `INSERT INTO pickup_photos (id, pickup_id, kind, storage_key, uploaded_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, pickupId, kind, storageKey, uploadedBy, at],
    );
  }

  findOnPickup(photoId: string, pickupId: string): Promise<ScalePhotoRow | null> {
    return one<ScalePhotoRow>(
      this.db,
      `SELECT storage_key, kind, uploaded_by, weigh_version FROM pickup_photos WHERE id = $1 AND pickup_id = $2`,
      [photoId, pickupId],
    );
  }

  /** Locks the photo if no weigh round has used it yet; false when it was used. */
  async lockUnused(tx: Db, photoId: string): Promise<boolean> {
    const claimed = await rows<{ id: string }>(
      tx,
      `SELECT id FROM pickup_photos WHERE id = $1 AND weigh_version IS NULL FOR UPDATE`,
      [photoId],
    );
    return claimed.length > 0;
  }

  async attachToWeigh(tx: Db, photoId: string, version: number): Promise<void> {
    await tx.query(`UPDATE pickup_photos SET weigh_version = $2 WHERE id = $1`, [photoId, version]);
  }

  /** How many of these ids are item photos of this pickup uploaded by this user. */
  async countOwnItemPhotos(tx: Db, photoIds: string[], pickupId: string, uploadedBy: string): Promise<number> {
    const found = await rows<{ id: string }>(
      tx,
      `SELECT id FROM pickup_photos WHERE id = ANY($1::uuid[]) AND pickup_id = $2 AND kind = 'ITEMS' AND uploaded_by = $3`,
      [photoIds, pickupId, uploadedBy],
    );
    return found.length;
  }
}
