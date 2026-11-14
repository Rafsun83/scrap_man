import { Inject, Injectable, Logger } from '@nestjs/common';
import { PICKUP_CODE_MAX_ATTEMPTS, type PaymentMethod } from '@bw/shared';
import { AppError, isUniqueViolation } from '../common/errors.js';
import { one, rows } from '../common/sql.js';
import { PHOTO_STORAGE, type PhotoStorage } from '../storage/storage.js';
import { lineAmountPaisa, paisaToDb, tenthsToDb, toPaisa, toTenths } from './money.js';
import { pickupCodeMatches } from './pickup-code.js';
import { PickupEvents } from './pickup-events.js';
import { PickupStore, type LockedPickup } from './pickup-store.js';
import type { PickupDto } from './pickup.view.js';
import type { DisputeRow, Viewer } from './records.js';

export interface WeightsInput {
  lines: { categoryCode: string; kg: number; quotedAmount?: number | null }[];
  scalePhotoId: string;
}

export interface PaymentInput {
  method: PaymentMethod;
  trxId?: string;
}

type ArriveResult = { kind: 'ARRIVED' } | { kind: 'MISMATCH'; left: number } | { kind: 'LOCKED'; justLocked: boolean };

/** Arriving with the pickup code, weighing, the household's confirmation, and payment. */
@Injectable()
export class WeighingService {
  private readonly logger = new Logger('Weighing');

  constructor(
    private readonly store: PickupStore,
    private readonly events: PickupEvents,
    @Inject(PHOTO_STORAGE) private readonly storage: PhotoStorage,
  ) {}

  /**
   * The collector enters the household's code. Wrong codes are counted (and committed) even
   * though the call fails; the 5th wrong code locks the pickup and alerts admins.
   */
  async arrive(collector: Viewer, pickupId: string, code: string): Promise<PickupDto> {
    const now = this.store.now();
    let locked: LockedPickup | null = null;
    const result = await this.store.db.transaction(async (tx): Promise<ArriveResult> => {
      const p = await this.store.lockFor(tx, pickupId, collector, false);
      locked = p;
      if (p.status !== 'ACCEPTED') {
        await this.store.transition(tx, p, 'ARRIVED', collector); // throws INVALID_STATE with the reason
      }
      if (p.code_attempts >= PICKUP_CODE_MAX_ATTEMPTS) return { kind: 'LOCKED', justLocked: false };
      if (p.pickup_code_hash && pickupCodeMatches(this.store.codeSecretForCheck(), pickupId, code, p.pickup_code_hash)) {
        await this.store.transition(tx, p, 'ARRIVED', collector, { arrived_at: now });
        return { kind: 'ARRIVED' };
      }
      const attempts = p.code_attempts + 1;
      await tx.query(`UPDATE pickups SET code_attempts = $2 WHERE id = $1`, [pickupId, attempts]);
      return attempts >= PICKUP_CODE_MAX_ATTEMPTS
        ? { kind: 'LOCKED', justLocked: true }
        : { kind: 'MISMATCH', left: PICKUP_CODE_MAX_ATTEMPTS - attempts };
    });

    const p = locked as LockedPickup | null;
    if (result.kind === 'MISMATCH') throw AppError.codeMismatch(result.left);
    if (result.kind === 'LOCKED') {
      if (result.justLocked && p) {
        this.logger.warn(`Pickup ${p.display_no} locked after ${PICKUP_CODE_MAX_ATTEMPTS} wrong codes (collector ${collector.id})`);
        this.events.codeLocked(p, now);
      }
      throw AppError.codeLocked();
    }
    await this.store.forgetCode(pickupId);
    this.events.changed('pickup.arrived', p!, 'ARRIVED', now);
    return this.store.view(pickupId, collector);
  }

  /**
   * A weigh round: first weigh (ARRIVED), the collector's re-weigh after a first rejection, or
   * an admin's weigh after TEAM_REWEIGH. The server computes every amount from the locked rates.
   */
  async submitWeights(actor: Viewer, pickupId: string, input: WeightsInput): Promise<PickupDto> {
    const now = this.store.now();
    // Check the upload outside the transaction so no row lock is held during a network call.
    const photo = await one<{ storage_key: string; kind: string; uploaded_by: string; weigh_version: number | null }>(
      this.store.db,
      `SELECT storage_key, kind, uploaded_by, weigh_version FROM pickup_photos WHERE id = $1 AND pickup_id = $2`,
      [input.scalePhotoId, pickupId],
    );
    if (!photo || photo.kind !== 'SCALE' || photo.uploaded_by !== actor.id || photo.weigh_version !== null) {
      throw AppError.scalePhotoRequired('Take a new photo of the scale for this weigh and upload it first.');
    }
    if (!(await this.storage.exists(photo.storage_key))) {
      throw AppError.scalePhotoRequired('The scale photo has not finished uploading. Upload it again, then send the weights.');
    }

    const outcome = await this.store.db.transaction(async (tx) => {
      const p = await this.store.lockFor(tx, pickupId, actor);
      const open = await one<DisputeRow>(
        tx,
        `SELECT * FROM disputes WHERE pickup_id = $1 AND status <> 'RESOLVED' FOR UPDATE`,
        [pickupId],
      );
      const lastWeight = await one<{ resolution: string | null }>(
        tx,
        `SELECT resolution FROM disputes WHERE pickup_id = $1 AND type = 'WEIGHT' ORDER BY created_at DESC LIMIT 1`,
        [pickupId],
      );

      if (p.status === 'DISPUTED') {
        const collectorReweigh = actor.role === 'COLLECTOR' && open?.type === 'WEIGHT' && open.status === 'REWEIGH';
        const teamReweigh = actor.role === 'ADMIN' && !open && lastWeight?.resolution === 'TEAM_REWEIGH';
        if (!collectorReweigh && !teamReweigh) {
          throw AppError.invalidState(
            actor.role === 'ADMIN'
              ? 'Resolve the dispute with TEAM_REWEIGH before entering weights.'
              : 'This dispute is with BhangariWala staff now; wait for their decision.',
            { status: p.status },
          );
        }
      } else if (p.status === 'ARRIVED') {
        if (actor.role !== 'COLLECTOR') throw AppError.invalidState('The collector weighs first.', { status: p.status });
      } else {
        await this.store.transition(tx, p, 'WEIGHED', actor); // throws INVALID_STATE
      }

      const items = await rows<{ category_id: string; code: string; pricing_type: string; rate_snapshot: string | null }>(
        tx,
        `SELECT pi.category_id, c.code, c.pricing_type, pi.rate_snapshot
           FROM pickup_items pi JOIN categories c ON c.id = pi.category_id WHERE pi.pickup_id = $1`,
        [pickupId],
      );
      const byCode = new Map(items.map((i) => [i.code, i]));
      const seen = new Set<string>();
      const lines = input.lines.map((l) => {
        const item = byCode.get(l.categoryCode);
        if (!item) {
          throw AppError.validation(`${l.categoryCode} is not part of this request. Weigh only the requested items.`, {
            categoryCode: l.categoryCode,
          });
        }
        if (seen.has(l.categoryCode)) throw AppError.validation(`${l.categoryCode} appears twice. Add its weight once.`);
        seen.add(l.categoryCode);
        if (item.pricing_type === 'PER_KG') {
          if (l.quotedAmount !== undefined && l.quotedAmount !== null) {
            throw AppError.validation(`${l.categoryCode} is priced per kg; do not send a quoted amount.`);
          }
          if (item.rate_snapshot === null) {
            throw AppError.invalidState(`No rate was locked for ${l.categoryCode}. Contact BhangariWala support.`);
          }
          return { item, kg: l.kg, rate: item.rate_snapshot, amountPaisa: lineAmountPaisa(l.kg, item.rate_snapshot) };
        }
        if (l.quotedAmount === undefined || l.quotedAmount === null) {
          throw AppError.validation(`${l.categoryCode} is priced on inspection: enter the amount you are offering.`);
        }
        return { item, kg: l.kg, rate: null, amountPaisa: toPaisa(l.quotedAmount) };
      });

      const claimed = await rows<{ id: string }>(
        tx,
        `SELECT id FROM pickup_photos WHERE id = $1 AND weigh_version IS NULL FOR UPDATE`,
        [input.scalePhotoId],
      );
      if (claimed.length === 0) throw AppError.scalePhotoRequired('This scale photo was already used. Take a new one.');

      const version =
        (await one<{ v: number }>(tx, `SELECT COALESCE(max(version), 0)::int AS v FROM weigh_lines WHERE pickup_id = $1`, [
          pickupId,
        ]))!.v + 1;
      for (const l of lines) {
        await tx.query(
          `INSERT INTO weigh_lines (pickup_id, category_id, version, kg, rate, amount, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [pickupId, l.item.category_id, version, tenthsToDb(toTenths(l.kg)), l.rate, paisaToDb(l.amountPaisa), actor.id, now],
        );
      }
      await tx.query(`UPDATE pickup_photos SET weigh_version = $2 WHERE id = $1`, [input.scalePhotoId, version]);

      const totalKg = tenthsToDb(lines.reduce((s, l) => s + toTenths(l.kg), 0));
      const totalAmount = paisaToDb(lines.reduce((s, l) => s + l.amountPaisa, 0));
      await this.store.transition(
        tx,
        p,
        'WEIGHED',
        actor,
        { weighed_at: now, total_kg: totalKg, total_amount: totalAmount },
        { version, totalKg, totalAmount },
      );

      let closed: string | null = null;
      if (open) {
        await tx.query(
          `UPDATE disputes SET status = 'RESOLVED', resolution = 'REWEIGHED', resolution_note = $2,
                  resolved_by = $3, resolved_at = $4 WHERE id = $1`,
          [open.id, `Re-weighed: ${totalKg} kg, ${totalAmount} taka`, actor.id, now],
        );
        closed = open.id;
      }
      return { p, closed };
    });

    this.events.changed('pickup.weighed', outcome.p, 'WEIGHED', now);
    if (outcome.closed) {
      const [d] = await this.store.disputeRows(this.store.db, `d.id = $1`, [outcome.closed]);
      if (d) this.events.dispute('dispute.resolved', d, outcome.p);
    }
    return this.store.view(pickupId, actor);
  }

  /** The household approves the weights and picks how to be paid. */
  async confirm(household: Viewer, pickupId: string, method: PaymentMethod, walletNumber?: string): Promise<PickupDto> {
    if (method !== 'CASH' && !walletNumber) {
      throw AppError.validation(`Enter the ${method === 'BKASH' ? 'bKash' : 'Nagad'} number to receive the money on.`);
    }
    const now = this.store.now();
    const p = await this.store.db.transaction(async (tx) => {
      const locked = await this.store.lockFor(tx, pickupId, household, false);
      await this.store.transition(
        tx,
        locked,
        'CONFIRMED',
        household,
        { confirmed_at: now, payment_method: method, wallet_number: method === 'CASH' ? null : walletNumber },
        { paymentMethod: method },
      );
      return locked;
    });
    this.events.changed('pickup.confirmed', p, 'CONFIRMED', now);
    return this.store.view(pickupId, household);
  }

  /**
   * The collector records the payment: CONFIRMED -> COMPLETED. After an admin's PAY_AGAIN
   * decision the collector records a new TrxID on the COMPLETED pickup.
   */
  async recordPayment(collector: Viewer, pickupId: string, input: PaymentInput): Promise<PickupDto> {
    const now = this.store.now();
    const trxId = input.method === 'CASH' ? null : input.trxId?.trim().toUpperCase() || null;
    if (input.method !== 'CASH' && !trxId) throw AppError.trxIdRequired();

    let p: LockedPickup;
    try {
      p = await this.store.db.transaction(async (tx) => {
        const locked = await this.store.lockFor(tx, pickupId, collector, false);
        if (trxId) {
          const used = await one(tx, `SELECT 1 FROM payments WHERE method = $1 AND trx_id = $2 AND pickup_id <> $3`, [
            input.method,
            trxId,
            pickupId,
          ]);
          if (used) throw AppError.trxIdReused();
        }

        if (locked.status === 'COMPLETED') {
          await this.payAgain(tx, locked, input.method, trxId, now);
          return locked;
        }
        if (locked.status === 'CONFIRMED' && input.method !== locked.payment_method) {
          throw AppError.validation(`The household chose ${locked.payment_method}. Pay with that method.`, {
            paymentMethod: locked.payment_method,
          });
        }
        await this.store.transition(tx, locked, 'COMPLETED', collector, { completed_at: now }, { method: input.method, trxId });
        await tx.query(
          `INSERT INTO payments (pickup_id, method, amount, wallet_number, trx_id, status, paid_at)
           VALUES ($1, $2, $3, $4, $5, 'PAID', $6)`,
          [pickupId, input.method, locked.total_amount, locked.wallet_number, trxId, now],
        );
        return locked;
      });
    } catch (error) {
      if (isUniqueViolation(error, 'payments_trx_once')) throw AppError.trxIdReused();
      throw error;
    }
    this.events.changed('pickup.paid', p, 'COMPLETED', now);
    return this.store.view(pickupId, collector);
  }

  private async payAgain(
    tx: Parameters<PickupStore['lock']>[0],
    p: LockedPickup,
    method: PaymentMethod,
    trxId: string | null,
    now: Date,
  ): Promise<void> {
    const payment = await one<{ method: PaymentMethod; status: string; trx_id: string | null }>(
      tx,
      `SELECT method, status, trx_id FROM payments WHERE pickup_id = $1 FOR UPDATE`,
      [p.id],
    );
    const last = await one<{ status: string; resolution: string | null }>(
      tx,
      `SELECT status, resolution FROM disputes WHERE pickup_id = $1 AND type = 'PAYMENT' ORDER BY created_at DESC LIMIT 1`,
      [p.id],
    );
    if (payment?.status !== 'REPORTED' || last?.status !== 'RESOLVED' || last.resolution !== 'PAY_AGAIN') {
      throw AppError.invalidState('This pickup is already paid.', { status: p.status });
    }
    if (method !== payment.method) {
      throw AppError.validation(`Pay again with ${payment.method}, the method the household chose.`);
    }
    if (trxId !== null && trxId === payment.trx_id) throw AppError.trxIdReused();
    await tx.query(`UPDATE payments SET trx_id = $2, status = 'PAID', paid_at = $3 WHERE pickup_id = $1`, [p.id, trxId, now]);
  }
}
