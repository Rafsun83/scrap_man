import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../../../common/clock.js';
import type { LatLng } from '../../../common/geo.js';
import { CollectorProfilesService } from '../../users/services/collector-profiles.service.js';
import { PickupsRepository } from '../repositories/pickups.repository.js';
import type { Viewer } from '../types/pickup-record.types.js';
import { PickupEventsService } from './pickup-events.service.js';

/** A collector going online or offline, and location pings shared with their households. */
@Injectable()
export class CollectorService {
  constructor(
    private readonly collectorProfilesService: CollectorProfilesService,
    private readonly pickupsRepository: PickupsRepository,
    private readonly pickupEventsService: PickupEventsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  setStatus(collector: Viewer, online: boolean, location?: LatLng): Promise<void> {
    return this.collectorProfilesService.setAvailability(collector.id, online, location);
  }

  /** Saves the location; households with an ACCEPTED pickup from this collector see it live. */
  async ping(collector: Viewer, location: LatLng): Promise<void> {
    const now = this.clock.now();
    await this.collectorProfilesService.saveLocation(collector.id, location, now);
    const active = await this.pickupsRepository.acceptedByCollector(collector.id);
    for (const p of active) this.pickupEventsService.collectorLocation(p.id, p.household_id, location.lat, location.lng, now);
  }
}
