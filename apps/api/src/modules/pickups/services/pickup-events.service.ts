import { Injectable } from '@nestjs/common';
import type { PickupStatus, SocketEvent } from '@bw/shared';
import { PushService, type PushKind } from '../../push/services/push.service.js';
import { RealtimeService } from '../../realtime/services/realtime.service.js';
import type { DisputeRow, PickupRecord, PickupRef } from '../types/pickup-record.types.js';
import { PickupViewsService } from './pickup-views.service.js';

/** Who gets a push for each pickup event (the person who made the change never does). */
const PUSH: Partial<Record<SocketEvent, { kind: PushKind; to: 'household' | 'collector' | 'both' }>> = {
  'pickup.accepted': { kind: 'ACCEPTED', to: 'household' },
  'pickup.released': { kind: 'RELEASED', to: 'household' },
  'pickup.weighed': { kind: 'WEIGHED', to: 'household' },
  'pickup.confirmed': { kind: 'CONFIRMED', to: 'collector' },
  'pickup.disputed': { kind: 'DISPUTED', to: 'collector' },
  'pickup.paid': { kind: 'PAID', to: 'household' },
  'pickup.cancelled': { kind: 'CANCELLED', to: 'both' },
  'request.expired': { kind: 'EXPIRED', to: 'household' },
};

/** Builds and sends the live events listed in docs/openapi.yaml (SocketEvents), and the matching pushes. */
@Injectable()
export class PickupEventsService {
  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly pickupViewsService: PickupViewsService,
    private readonly pushService: PushService,
  ) {}

  /**
   * pickup.* and request.expired: to the household, the collector (if any) and admins, plus a push to whoever
   * the event is news for. `opts.actorId` is left out of the push; `opts.noShow` uses the no-show wording.
   */
  changed(
    event: SocketEvent,
    p: PickupRef,
    status: PickupStatus,
    at: Date,
    extraUserIds: string[] = [],
    opts: { actorId?: string; noShow?: boolean; collectorName?: string | null } = {},
  ): void {
    const displayNo = this.pickupViewsService.displayNo(p.display_no);
    this.realtimeService.emit(event, { pickupId: p.id, displayNo, status, at: at.toISOString() }, [
      p.household_id,
      p.collector_id,
      ...extraUserIds,
    ]);
    const push = PUSH[event];
    if (!push) return;
    const to = push.to === 'household' ? [p.household_id] : push.to === 'collector' ? [p.collector_id] : [p.household_id, p.collector_id];
    this.pushService.notify(
      to.filter((id) => id !== opts.actorId),
      opts.noShow ? 'NO_SHOW' : push.kind,
      { no: displayNo, name: opts.collectorName ?? '' },
      { event, pickupId: p.id },
    );
  }

  /** request.created: each collector gets their own distance. */
  requestCreated(rec: PickupRecord, collectors: { userId: string; distanceM: number }[]): void {
    this.realtimeService.emitEach(
      'request.created',
      collectors.map((c) => ({ userId: c.userId, payload: this.pickupViewsService.toNearbyRequest(rec, c.distanceM) })),
    );
    this.realtimeService.emit('request.created', this.pickupViewsService.toNearbyRequest(rec, 0), [], true); // admins' live view
    this.pushService.notify(
      collectors.map((c) => c.userId),
      'NEW_REQUEST',
      { area: rec.row.area },
      { event: 'request.created', pickupId: rec.row.id },
    );
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
    const data = { event, pickupId: p.id };
    const no = this.pickupViewsService.displayNo(p.display_no);
    // A weight dispute is announced by pickup.disputed; a payment report is news for the collector.
    if (event === 'dispute.opened' && d.type === 'PAYMENT') this.pushService.notify([p.collector_id], 'PAYMENT_REPORTED', { no }, data);
    if (event === 'dispute.resolved' && d.resolution !== 'REWEIGHED') this.pushService.notify([p.household_id, p.collector_id], 'RESOLVED', { no }, data);
  }
}
