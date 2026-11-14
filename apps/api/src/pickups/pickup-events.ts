import { Injectable } from '@nestjs/common';
import type { PickupStatus, SocketEvent } from '@bw/shared';
import { RealtimeService } from '../realtime/realtime.service.js';
import { toDisputeDto, toNearbyRequest } from './pickup.view.js';
import { displayNo, type DisputeRow, type PickupRecord } from './records.js';

interface PickupRef {
  id: string;
  display_no: string;
  household_id: string;
  collector_id: string | null;
}

/** Builds and sends the live events listed in docs/openapi.yaml (SocketEvents). */
@Injectable()
export class PickupEvents {
  constructor(private readonly realtime: RealtimeService) {}

  /** pickup.* and request.expired: to the household, the collector (if any) and admins. */
  changed(event: SocketEvent, p: PickupRef, status: PickupStatus, at: Date, extraUserIds: string[] = []): void {
    this.realtime.emit(
      event,
      { pickupId: p.id, displayNo: displayNo(p.display_no), status, at: at.toISOString() },
      [p.household_id, p.collector_id, ...extraUserIds],
    );
  }

  /** request.created: each collector gets their own distance. */
  requestCreated(rec: PickupRecord, collectors: { userId: string; distanceM: number }[]): void {
    this.realtime.emitEach(
      'request.created',
      collectors.map((c) => ({ userId: c.userId, payload: toNearbyRequest(rec, c.distanceM) })),
    );
    this.realtime.emit('request.created', toNearbyRequest(rec, 0), [], true); // admins' live view
  }

  /** request.taken: the request is gone from these collectors' lists. */
  requestTaken(pickupId: string, reason: 'ACCEPTED' | 'CANCELLED' | 'EXPIRED', collectorIds: string[]): void {
    this.realtime.emit('request.taken', { pickupId, reason }, collectorIds, false);
  }

  collectorLocation(pickupId: string, householdId: string, lat: number, lng: number, at: Date): void {
    this.realtime.emit('collector.location', { pickupId, lat, lng, at: at.toISOString() }, [householdId], false);
  }

  codeLocked(p: PickupRef, at: Date): void {
    this.realtime.emit(
      'pickup.code_locked',
      { pickupId: p.id, displayNo: displayNo(p.display_no), collectorId: p.collector_id, at: at.toISOString() },
      [],
      true,
    );
  }

  dispute(event: 'dispute.opened' | 'dispute.resolved', d: DisputeRow, p: PickupRef): void {
    this.realtime.emit(event, toDisputeDto(d), [p.household_id, p.collector_id]);
  }
}
