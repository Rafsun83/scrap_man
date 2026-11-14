import { Injectable } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { rows } from '../common/sql.js';
import { MatchingService } from './matching.service.js';
import { PickupEvents } from './pickup-events.js';
import { PickupStore } from './pickup-store.js';
import type { Viewer } from './records.js';

export interface LatLng {
  lat: number;
  lng: number;
}

const POINT = `ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography`;

/** A collector going online or offline, and location pings. */
@Injectable()
export class CollectorService {
  constructor(
    private readonly store: PickupStore,
    private readonly matching: MatchingService,
    private readonly events: PickupEvents,
  ) {}

  async setStatus(collector: Viewer, online: boolean, location?: LatLng): Promise<void> {
    await this.matching.approvedProfile(collector.id);
    if (online && !location) throw AppError.validation('Share your location to go online.');
    const now = this.store.now();
    if (location) {
      await this.store.db.query(
        `UPDATE collector_profiles SET is_online = $4, last_location = ${POINT}, last_seen_at = $5, updated_at = $5
          WHERE user_id = $1`,
        [collector.id, location.lat, location.lng, online, now],
      );
    } else {
      await this.store.db.query(`UPDATE collector_profiles SET is_online = $2, updated_at = $3 WHERE user_id = $1`, [
        collector.id,
        online,
        now,
      ]);
    }
  }

  /** Saves the location; households with an ACCEPTED pickup from this collector see it live. */
  async ping(collector: Viewer, location: LatLng): Promise<void> {
    await this.matching.approvedProfile(collector.id);
    const now = this.store.now();
    await this.store.db.query(
      `UPDATE collector_profiles SET last_location = ${POINT}, last_seen_at = $4 WHERE user_id = $1`,
      [collector.id, location.lat, location.lng, now],
    );
    const active = await rows<{ id: string; household_id: string }>(
      this.store.db,
      `SELECT id, household_id FROM pickups WHERE collector_id = $1 AND status = 'ACCEPTED'`,
      [collector.id],
    );
    for (const p of active) this.events.collectorLocation(p.id, p.household_id, location.lat, location.lng, now);
  }
}
