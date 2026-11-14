import { Injectable } from '@nestjs/common';
import {
  ACTIVE_PICKUP_STATUSES,
  OUTCOMES_BY_DISPUTE_TYPE,
  type DisputeOutcome,
  type DisputeStatus,
  type DisputeType,
} from '@bw/shared';
import { AppError, isUniqueViolation } from '../common/errors.js';
import { one, rows } from '../common/sql.js';
import { PickupEvents } from './pickup-events.js';
import { PickupStore, type LockedPickup } from './pickup-store.js';
import { toDisputeDto } from './pickup.view.js';
import type { DisputeRow, Viewer } from './records.js';

export interface OpenDisputeInput {
  type: DisputeType;
  reason?: string;
  photoIds?: string[];
}

/** Household disputes and the admin decisions that close them. */
@Injectable()
export class DisputesService {
  constructor(
    private readonly store: PickupStore,
    private readonly events: PickupEvents,
  ) {}

  /**
   * WEIGHT moves a WEIGHED pickup to DISPUTED (first time: collector re-weighs; after that: admin
   * review). PAYMENT marks a completed payment REPORTED. BEHAVIOUR and OTHER go to admin review.
   * Only WEIGHT changes the pickup status.
   */
  async open(household: Viewer, pickupId: string, input: OpenDisputeInput) {
    const now = this.store.now();
    let created: { d: DisputeRow; p: LockedPickup };
    try {
      created = await this.store.db.transaction(async (tx) => {
        const p = await this.store.lockFor(tx, pickupId, household, false);
        const open = await one(tx, `SELECT 1 FROM disputes WHERE pickup_id = $1 AND status <> 'RESOLVED'`, [pickupId]);
        if (open) throw AppError.invalidState('A problem is already open for this pickup. Wait for it to be resolved.');

        const photoIds = [...new Set(input.photoIds ?? [])];
        if (photoIds.length) {
          const found = await rows<{ id: string }>(
            tx,
            `SELECT id FROM pickup_photos WHERE id = ANY($1::uuid[]) AND pickup_id = $2 AND kind = 'ITEMS' AND uploaded_by = $3`,
            [photoIds, pickupId, household.id],
          );
          if (found.length !== photoIds.length) {
            throw AppError.validation('Some photos are not yours or not from this pickup. Upload them again.');
          }
        }

        let status: DisputeStatus = 'ADMIN_REVIEW';
        if (input.type === 'WEIGHT') {
          const earlier = (await one<{ n: number }>(
            tx,
            `SELECT count(*)::int AS n FROM disputes WHERE pickup_id = $1 AND type = 'WEIGHT'`,
            [pickupId],
          ))!.n;
          status = earlier === 0 ? 'REWEIGH' : 'ADMIN_REVIEW';
          await this.store.transition(tx, p, 'DISPUTED', household, {}, { disputeType: 'WEIGHT', disputeStatus: status });
        } else if (input.type === 'PAYMENT') {
          const paid = await rows<{ pickup_id: string }>(
            tx,
            `UPDATE payments SET status = 'REPORTED' WHERE pickup_id = $1 AND status = 'PAID' RETURNING pickup_id`,
            [pickupId],
          );
          if (p.status !== 'COMPLETED' || paid.length === 0) {
            throw AppError.invalidState('You can report a missing payment only after the collector records it.', {
              status: p.status,
            });
          }
        } else if (!p.collector_id) {
          throw AppError.invalidState('No collector has taken this pickup yet, so there is nothing to report.', {
            status: p.status,
          });
        }

        const row = await one<{ id: string }>(
          tx,
          `INSERT INTO disputes (pickup_id, raised_by, type, status, reason, photo_ids, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [pickupId, household.id, input.type, status, input.reason ?? null, photoIds, now],
        );
        const [d] = await this.store.disputeRows(tx, `d.id = $1`, [row!.id]);
        return { d, p };
      });
    } catch (error) {
      if (isUniqueViolation(error, 'disputes_one_open_idx')) {
        throw AppError.invalidState('A problem is already open for this pickup. Wait for it to be resolved.');
      }
      throw error;
    }

    const { d, p } = created;
    if (d.type === 'WEIGHT') this.events.changed('pickup.disputed', p, 'DISPUTED', now);
    this.events.dispute('dispute.opened', d, p);
    return toDisputeDto(d);
  }

  async list(status?: DisputeStatus) {
    const found = await this.store.disputeRows(
      this.store.db,
      `($1::dispute_status IS NULL OR d.status = $1)`,
      [status ?? null],
      `ORDER BY (d.status = 'RESOLVED'), d.created_at DESC LIMIT 200`,
    );
    return found.map(toDisputeDto);
  }

  /** An admin closes a dispute in ADMIN_REVIEW with one of the outcomes allowed for its type. */
  async resolve(admin: Viewer, disputeId: string, outcome: DisputeOutcome, note: string) {
    const ref = await one<{ pickup_id: string; type: DisputeType }>(
      this.store.db,
      `SELECT pickup_id, type FROM disputes WHERE id = $1`,
      [disputeId],
    );
    if (!ref) throw AppError.notFound('That dispute was not found.');
    if (!OUTCOMES_BY_DISPUTE_TYPE[ref.type].includes(outcome)) {
      throw AppError.validation(
        `A ${ref.type} dispute can be closed with: ${OUTCOMES_BY_DISPUTE_TYPE[ref.type].join(', ')}.`,
        { allowed: OUTCOMES_BY_DISPUTE_TYPE[ref.type] },
      );
    }
    const now = this.store.now();
    const { p, pickupEvent } = await this.store.db.transaction(async (tx) => {
      const p = (await this.store.lock(tx, ref.pickup_id))!; // pickup first, then dispute: same order as weighing
      const d = await one<{ status: DisputeStatus }>(tx, `SELECT status FROM disputes WHERE id = $1 FOR UPDATE`, [disputeId]);
      if (d?.status !== 'ADMIN_REVIEW') {
        throw AppError.invalidState(
          d?.status === 'RESOLVED' ? 'This dispute is already resolved.' : 'The collector is re-weighing; wait for the new weights.',
          { disputeStatus: d?.status },
        );
      }

      let pickupEvent: 'pickup.weighed' | 'pickup.cancelled' | null = null;
      switch (outcome) {
        case 'ACCEPT_WEIGHTS':
          await this.store.transition(tx, p, 'WEIGHED', admin, {}, { disputeId, outcome });
          pickupEvent = 'pickup.weighed';
          break;
        case 'CANCEL':
          if (!ACTIVE_PICKUP_STATUSES.includes(p.status)) {
            throw AppError.invalidState('This pickup is already finished, so it cannot be cancelled.', { status: p.status });
          }
          await this.store.transition(tx, p, 'CANCELLED', admin, { cancelled_at: now }, { disputeId, outcome, reason: note });
          pickupEvent = 'pickup.cancelled';
          break;
        case 'PAYMENT_VERIFIED':
          await tx.query(`UPDATE payments SET status = 'VERIFIED' WHERE pickup_id = $1`, [p.id]);
          break;
        case 'SUSPEND_COLLECTOR':
          if (!p.collector_id) throw AppError.invalidState('This pickup has no collector to suspend.');
          await tx.query(`UPDATE users SET status = 'SUSPENDED', updated_at = $2 WHERE id = $1`, [p.collector_id, now]);
          await tx.query(`UPDATE collector_profiles SET is_online = false, updated_at = $2 WHERE user_id = $1`, [
            p.collector_id,
            now,
          ]);
          break;
        // TEAM_REWEIGH: the pickup stays DISPUTED until an admin posts weights.
        // PAY_AGAIN: the payment stays REPORTED until the collector records a new TrxID.
        // NO_ACTION: nothing else changes.
        default:
          break;
      }
      await tx.query(
        `UPDATE disputes SET status = 'RESOLVED', resolution = $2, resolution_note = $3, resolved_by = $4, resolved_at = $5
          WHERE id = $1`,
        [disputeId, outcome, note, admin.id, now],
      );
      return { p, pickupEvent };
    });

    if (pickupEvent) {
      this.events.changed(pickupEvent, p, pickupEvent === 'pickup.weighed' ? 'WEIGHED' : 'CANCELLED', now);
    }
    if (pickupEvent === 'pickup.cancelled') await this.store.forgetCode(p.id);
    const [d] = await this.store.disputeRows(this.store.db, `d.id = $1`, [disputeId]);
    this.events.dispute('dispute.resolved', d, p);
    return toDisputeDto(d);
  }
}
