import { Inject, Injectable } from '@nestjs/common';
import type { PickupStatus } from '@bw/shared';
import { CLOCK, type Clock } from '../../../common/clock.js';
import { AppError } from '../../../common/errors.js';
import type { Db } from '../../../common/sql.js';
import { PickupsRepository } from '../repositories/pickups.repository.js';
import type { ActorRef, LockedPickup, Viewer } from '../types/pickup-record.types.js';
import { pickupStateMachineUtil } from '../utils/pickup-state-machine.util.js';

/** Who may change a pickup, and the one place a pickup's status changes (with its status_events row). */
@Injectable()
export class PickupStateService {
  constructor(
    private readonly pickupsRepository: PickupsRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Locks the pickup and checks the user is its household, its collector, or (if allowed) an admin. */
  async lockFor(tx: Db, id: string, viewer: Viewer, allowAdmin = true): Promise<LockedPickup> {
    const p = await this.pickupsRepository.lock(tx, id);
    const mine =
      p &&
      ((viewer.role === 'HOUSEHOLD' && p.household_id === viewer.id) ||
        (viewer.role === 'COLLECTOR' && p.collector_id === viewer.id) ||
        (viewer.role === 'ADMIN' && allowAdmin));
    if (!p || !mine) throw AppError.notFound('That pickup was not found.');
    return p;
  }

  /**
   * The only way a pickup's status changes: checks the state machine, updates the row only if
   * its status is still `from`, and writes the status_events row in the same transaction.
   */
  async transition(
    tx: Db,
    current: { id: string; status: PickupStatus },
    to: PickupStatus,
    actor: ActorRef,
    set: Record<string, unknown> = {},
    meta: Record<string, unknown> | null = null,
  ): Promise<void> {
    pickupStateMachineUtil.assertTransition(current.status, to, actor.role);
    const updated = await this.pickupsRepository.updateStatusIf(tx, current.id, current.status, to, set);
    if (!updated) {
      throw AppError.invalidState('This pickup changed while you were working on it. Refresh to see the latest.');
    }
    await this.recordEvent(tx, current.id, current.status, to, actor, meta);
  }

  recordEvent(
    tx: Db,
    pickupId: string,
    from: PickupStatus | null,
    to: PickupStatus,
    actor: ActorRef,
    meta: Record<string, unknown> | null = null,
  ): Promise<void> {
    return this.pickupsRepository.insertStatusEvent(tx, {
      pickupId,
      from,
      to,
      actorId: actor.id,
      actorRole: actor.role === 'SYSTEM' ? null : actor.role,
      meta,
      at: this.clock.now(),
    });
  }
}
