import { Inject, Injectable } from '@nestjs/common';
import {
  ACTIVE_PICKUP_STATUSES,
  OUTCOMES_BY_DISPUTE_TYPE,
  type DisputeOutcome,
  type DisputeStatus,
} from '@bw/shared';
import { CLOCK, type Clock } from '../../../common/clock.js';
import { AppError, isUniqueViolation } from '../../../common/errors.js';
import { UsersService } from '../../users/services/users.service.js';
import type { DisputeDto } from '../dtos/dispute.dto.js';
import type { OpenDisputeDto } from '../dtos/open-dispute.dto.js';
import { DisputesRepository } from '../repositories/disputes.repository.js';
import { PaymentsRepository } from '../repositories/payments.repository.js';
import { PhotosRepository } from '../repositories/photos.repository.js';
import { PickupsRepository } from '../repositories/pickups.repository.js';
import type { DisputeRow, LockedPickup, Viewer } from '../types/pickup-record.types.js';
import { PickupCodeService } from './pickup-code.service.js';
import { PickupEventsService } from './pickup-events.service.js';
import { PickupStateService } from './pickup-state.service.js';
import { PickupViewsService } from './pickup-views.service.js';

/** Household disputes and the admin decisions that close them. */
@Injectable()
export class DisputesService {
  constructor(
    private readonly disputesRepository: DisputesRepository,
    private readonly pickupsRepository: PickupsRepository,
    private readonly photosRepository: PhotosRepository,
    private readonly paymentsRepository: PaymentsRepository,
    private readonly pickupStateService: PickupStateService,
    private readonly pickupCodeService: PickupCodeService,
    private readonly pickupViewsService: PickupViewsService,
    private readonly pickupEventsService: PickupEventsService,
    private readonly usersService: UsersService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * WEIGHT moves a WEIGHED pickup to DISPUTED (first time: collector re-weighs; after that: admin
   * review). PAYMENT marks a completed payment REPORTED. BEHAVIOUR and OTHER go to admin review.
   * Only WEIGHT changes the pickup status.
   */
  async open(household: Viewer, pickupId: string, input: OpenDisputeDto): Promise<DisputeDto> {
    const now = this.clock.now();
    let created: { d: DisputeRow; p: LockedPickup };
    try {
      created = await this.pickupsRepository.transaction(async (tx) => {
        const p = await this.pickupStateService.lockFor(tx, pickupId, household, false);
        if (await this.disputesRepository.hasOpen(tx, pickupId)) {
          throw AppError.invalidState('A problem is already open for this pickup. Wait for it to be resolved.');
        }

        const photoIds = [...new Set(input.photoIds ?? [])];
        if (photoIds.length) {
          const found = await this.photosRepository.countOwnItemPhotos(tx, photoIds, pickupId, household.id);
          if (found !== photoIds.length) {
            throw AppError.validation('Some photos are not yours or not from this pickup. Upload them again.');
          }
        }

        let status: DisputeStatus = 'ADMIN_REVIEW';
        if (input.type === 'WEIGHT') {
          const earlier = await this.disputesRepository.countOfType(tx, pickupId, 'WEIGHT');
          status = earlier === 0 ? 'REWEIGH' : 'ADMIN_REVIEW';
          await this.pickupStateService.transition(tx, p, 'DISPUTED', household, {}, { disputeType: 'WEIGHT', disputeStatus: status });
        } else if (input.type === 'PAYMENT') {
          const reported = await this.paymentsRepository.markReported(tx, pickupId);
          if (p.status !== 'COMPLETED' || !reported) {
            throw AppError.invalidState('You can report a missing payment only after the collector records it.', {
              status: p.status,
            });
          }
        } else if (!p.collector_id) {
          throw AppError.invalidState('No collector has taken this pickup yet, so there is nothing to report.', {
            status: p.status,
          });
        }

        const id = await this.disputesRepository.insert(tx, {
          pickupId,
          raisedBy: household.id,
          type: input.type,
          status,
          reason: input.reason ?? null,
          photoIds,
          at: now,
        });
        const d = (await this.disputesRepository.byId(id, tx))!;
        return { d, p };
      });
    } catch (error) {
      if (isUniqueViolation(error, 'disputes_one_open_idx')) {
        throw AppError.invalidState('A problem is already open for this pickup. Wait for it to be resolved.');
      }
      throw error;
    }

    const { d, p } = created;
    if (d.type === 'WEIGHT') this.pickupEventsService.changed('pickup.disputed', p, 'DISPUTED', now);
    this.pickupEventsService.dispute('dispute.opened', d, p);
    return this.pickupViewsService.toDisputeDto(d);
  }

  async list(status?: DisputeStatus): Promise<DisputeDto[]> {
    const found = await this.disputesRepository.list(status ?? null);
    return found.map((d) => this.pickupViewsService.toDisputeDto(d));
  }

  /** An admin closes a dispute in ADMIN_REVIEW with one of the outcomes allowed for its type. */
  async resolve(admin: Viewer, disputeId: string, outcome: DisputeOutcome, note: string): Promise<DisputeDto> {
    const ref = await this.disputesRepository.findRef(disputeId);
    if (!ref) throw AppError.notFound('That dispute was not found.');
    if (!OUTCOMES_BY_DISPUTE_TYPE[ref.type].includes(outcome)) {
      throw AppError.validation(
        `A ${ref.type} dispute can be closed with: ${OUTCOMES_BY_DISPUTE_TYPE[ref.type].join(', ')}.`,
        { allowed: OUTCOMES_BY_DISPUTE_TYPE[ref.type] },
      );
    }
    const now = this.clock.now();
    const { p, pickupEvent } = await this.pickupsRepository.transaction(async (tx) => {
      const p = (await this.pickupsRepository.lock(tx, ref.pickup_id))!; // pickup first, then dispute: same order as weighing
      const d = await this.disputesRepository.lockStatus(tx, disputeId);
      if (d?.status !== 'ADMIN_REVIEW') {
        throw AppError.invalidState(
          d?.status === 'RESOLVED' ? 'This dispute is already resolved.' : 'The collector is re-weighing; wait for the new weights.',
          { disputeStatus: d?.status },
        );
      }

      let pickupEvent: 'pickup.weighed' | 'pickup.cancelled' | null = null;
      switch (outcome) {
        case 'ACCEPT_WEIGHTS':
          await this.pickupStateService.transition(tx, p, 'WEIGHED', admin, {}, { disputeId, outcome });
          pickupEvent = 'pickup.weighed';
          break;
        case 'CANCEL':
          if (!ACTIVE_PICKUP_STATUSES.includes(p.status)) {
            throw AppError.invalidState('This pickup is already finished, so it cannot be cancelled.', { status: p.status });
          }
          await this.pickupStateService.transition(tx, p, 'CANCELLED', admin, { cancelled_at: now }, { disputeId, outcome, reason: note });
          pickupEvent = 'pickup.cancelled';
          break;
        case 'PAYMENT_VERIFIED':
          await this.paymentsRepository.markVerified(tx, p.id);
          break;
        case 'SUSPEND_COLLECTOR':
          if (!p.collector_id) throw AppError.invalidState('This pickup has no collector to suspend.');
          await this.usersService.suspend(tx, p.collector_id, now);
          break;
        // TEAM_REWEIGH: the pickup stays DISPUTED until an admin posts weights.
        // PAY_AGAIN: the payment stays REPORTED until the collector records a new TrxID.
        // NO_ACTION: nothing else changes.
        default:
          break;
      }
      await this.disputesRepository.resolve(tx, disputeId, outcome, note, admin.id, now);
      return { p, pickupEvent };
    });

    if (pickupEvent) {
      this.pickupEventsService.changed(pickupEvent, p, pickupEvent === 'pickup.weighed' ? 'WEIGHED' : 'CANCELLED', now);
    }
    if (pickupEvent === 'pickup.cancelled') await this.pickupCodeService.forget(p.id);
    const d = (await this.disputesRepository.byId(disputeId))!;
    this.pickupEventsService.dispute('dispute.resolved', d, p);
    return this.pickupViewsService.toDisputeDto(d);
  }
}
