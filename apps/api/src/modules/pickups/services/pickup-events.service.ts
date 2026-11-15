import { Injectable } from '@nestjs/common';
import type { PickupStatus, SocketEvent } from '@bw/shared';
import { RealtimeService } from '../../realtime/services/realtime.service.js';
import type { DisputeRow, PickupRecord, PickupRef } from '../types/pickup-record.types.js';
import { PickupViewsService } from './pickup-views.service.js';

/** Builds and sends the live events listed in docs/openapi.yaml (SocketEvents). */
@Injectable()
export class PickupEventsService {
  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly pickupViewsService: PickupViewsService,
  ) {}

  /** pickup.* and request.expired: to the household, the collector (if any) and admins. */
  changed(event: SocketEvent, p: PickupRef, status: PickupStatus, at: Date, extraUserIds: string[] = []): void {
    this.realtimeService.emit(
      event,
      { pickupId: p.id, displayNo: this.pickupViewsService.displayNo(p.display_no), status, at: at.toISOString() },
      [p.household_id, p.collector_id, ...extraUserIds],
    );
  }

  /** request.created: each collector gets their own distance. */
  requestCreated(rec: PickupRecord, collectors: { userId: string; distanceM: number }[]): void {
    this.realtimeService.emitEach(
      'request.created',
      collectors.map((c) => ({ userId: c.userId, payload: this.pickupViewsService.toNearbyRequest(rec, c.distanceM) })),
    );
    this.realtimeService.emit('request.created', this.pickupViewsService.toNearbyRequest(rec, 0), [], true); // admins' live view
  }

  /** request.taken: the request is gone from these collectors' lists. */
  requestTaken(pickupId: string, reason: 'ACCEPTED' | 'CANCELLED' | 'EXPIRED', collectorIds: string[]): void {
    this.realtimeService.emit('request.taken', { pickupId, reason }, collectorIds, false);
  }

  collectorLocation(pickupId: string, householdId: string, lat: number, lng: number, at: Date): void {
    this.realtimeService.emit('collector.location', { pickupId, lat, lng, at: at.toISOString() }, [householdId], false);
  }

  codeLocked(p: PickupRef, at: Date): void {
    this.realtimeService.emit(
      'pickup.code_locked',
      { pickupId: p.id, displayNo: this.pickupViewsService.displayNo(p.display_no), collectorId: p.collector_id, at: at.toISOString() },
      [],
      true,
    );
  }

  dispute(event: 'dispute.opened' | 'dispute.resolved', d: DisputeRow, p: PickupRef): void {
    this.realtimeService.emit(event, this.pickupViewsService.toDisputeDto(d), [p.household_id, p.collector_id]);
  }
}
