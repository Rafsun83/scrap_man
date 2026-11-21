import { Inject, Injectable, Logger } from '@nestjs/common';
import { PICKUP_CODE_MAX_ATTEMPTS, type PaymentMethod } from '@bw/shared';
import { CLOCK, type Clock } from '../../../common/clock.js';
import { AppError, isUniqueViolation } from '../../../common/errors.js';
import type { Db } from '../../../common/sql.js';
import { dhakaToday } from '../../../common/time.js';
import { PHOTO_STORAGE } from '../../storage/storage.module.js';
import type { PhotoStorage } from '../../storage/types/photo-storage.type.js';
import type { PickupDto } from '../dtos/pickup.dto.js';
import type { RecordPaymentDto } from '../dtos/record-payment.dto.js';
import type { SubmitWeightsDto } from '../dtos/submit-weights.dto.js';
import { DisputesRepository } from '../repositories/disputes.repository.js';
import { PaymentsRepository } from '../repositories/payments.repository.js';
import { PhotosRepository } from '../repositories/photos.repository.js';
import { PickupsRepository } from '../repositories/pickups.repository.js';
import { WeighingRepository, type WeighItemRow } from '../repositories/weighing.repository.js';
import type { LockedPickup, Viewer } from '../types/pickup-record.types.js';
import { moneyUtil } from '../utils/money.util.js';
import { PickupCodeService } from './pickup-code.service.js';
import { PickupEventsService } from './pickup-events.service.js';
import { PickupStateService } from './pickup-state.service.js';
import { PickupViewsService } from './pickup-views.service.js';

type ArriveResult = { kind: 'ARRIVED' } | { kind: 'MISMATCH'; left: number } | { kind: 'LOCKED'; justLocked: boolean };

/** Arriving with the pickup code, weighing, the household's confirmation, and payment. */
@Injectable()
export class WeighingService {
  private readonly logger = new Logger('Weighing');

  constructor(
    private readonly pickupsRepository: PickupsRepository,
    private readonly weighingRepository: WeighingRepository,
    private readonly photosRepository: PhotosRepository,
    private readonly paymentsRepository: PaymentsRepository,
    private readonly disputesRepository: DisputesRepository,
    private readonly pickupStateService: PickupStateService,
    private readonly pickupCodeService: PickupCodeService,
    private readonly pickupViewsService: PickupViewsService,
    private readonly pickupEventsService: PickupEventsService,
    @Inject(PHOTO_STORAGE) private readonly storage: PhotoStorage,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * The collector enters the household's code. Wrong codes are counted (and committed) even
   * though the call fails; the 5th wrong code locks the pickup and alerts admins.
   */
  async arrive(collector: Viewer, pickupId: string, code: string): Promise<PickupDto> {
    const now = this.clock.now();
    let locked: LockedPickup | null = null;
    const result = await this.pickupsRepository.transaction(async (tx): Promise<ArriveResult> => {
      const p = await this.pickupStateService.lockFor(tx, pickupId, collector, false);
      locked = p;
      if (p.status !== 'ACCEPTED') {
        await this.pickupStateService.transition(tx, p, 'ARRIVED', collector); // throws INVALID_STATE with the reason
      }
      if (p.code_attempts >= PICKUP_CODE_MAX_ATTEMPTS) return { kind: 'LOCKED', justLocked: false };
      if (p.pickup_code_hash && this.pickupCodeService.matches(pickupId, code, p.pickup_code_hash)) {
        await this.pickupStateService.transition(tx, p, 'ARRIVED', collector, { arrived_at: now });
        return { kind: 'ARRIVED' };
      }
      const attempts = p.code_attempts + 1;
      await this.pickupsRepository.setCodeAttempts(tx, pickupId, attempts);
      return attempts >= PICKUP_CODE_MAX_ATTEMPTS
        ? { kind: 'LOCKED', justLocked: true }
        : { kind: 'MISMATCH', left: PICKUP_CODE_MAX_ATTEMPTS - attempts };
    });

    const p = locked as LockedPickup | null;
    if (result.kind === 'MISMATCH') throw AppError.codeMismatch(result.left);
    if (result.kind === 'LOCKED') {
      if (result.justLocked && p) {
        this.logger.warn(`Pickup ${p.display_no} locked after ${PICKUP_CODE_MAX_ATTEMPTS} wrong codes (collector ${collector.id})`);
        this.pickupEventsService.codeLocked(p, now);
      }
      throw AppError.codeLocked();
    }
    await this.pickupCodeService.forget(pickupId);
    this.pickupEventsService.changed('pickup.arrived', p!, 'ARRIVED', now);
    return this.pickupViewsService.view(pickupId, collector);
  }

  /**
   * A weigh round: first weigh (ARRIVED), the collector's re-weigh after a first rejection, or
   * an admin's weigh after TEAM_REWEIGH. The server computes every amount from the locked rates.
   */
  async submitWeights(actor: Viewer, pickupId: string, input: SubmitWeightsDto): Promise<PickupDto> {
    const now = this.clock.now();
    // The scale photo is optional; when one is sent, check the upload outside the transaction so no row lock is
    // held during a network call.
    const scalePhotoId = input.scalePhotoId ?? null;
    if (scalePhotoId) {
      const photo = await this.photosRepository.findOnPickup(scalePhotoId, pickupId);
      if (!photo || photo.kind !== 'SCALE' || photo.uploaded_by !== actor.id || photo.weigh_version !== null) {
        throw AppError.scalePhotoRequired('This scale photo cannot be used. Take a new one, or send the weights without a photo.');
      }
      if (!(await this.storage.exists(photo.storage_key))) {
        throw AppError.scalePhotoRequired('The scale photo has not finished uploading. Upload it again, or send the weights without a photo.');
      }
    }

    const outcome = await this.pickupsRepository.transaction(async (tx) => {
      const p = await this.pickupStateService.lockFor(tx, pickupId, actor);
      const open = await this.disputesRepository.lockOpen(tx, pickupId);
      const lastWeight = await this.disputesRepository.latestOfType(tx, pickupId, 'WEIGHT');

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
        await this.pickupStateService.transition(tx, p, 'WEIGHED', actor); // throws INVALID_STATE
      }

      const byCode = await this.itemsForLines(tx, pickupId, input.lines.map((l) => l.categoryCode), now);
      const seen = new Set<string>();
      const lines = input.lines.map((l) => {
        const item = byCode.get(l.categoryCode)!;
        if (seen.has(l.categoryCode)) throw AppError.validation(`${l.categoryCode} appears twice. Add its weight once.`);
        seen.add(l.categoryCode);
        if (item.pricing_type === 'PER_KG') {
          if (l.quotedAmount !== undefined && l.quotedAmount !== null) {
            throw AppError.validation(`${l.categoryCode} is priced per kg; do not send a quoted amount.`);
          }
          if (item.rate_snapshot === null) {
            throw AppError.invalidState(`No rate was locked for ${l.categoryCode}. Contact BhangariWala support.`);
          }
          return { item, kg: l.kg, rate: item.rate_snapshot, amountPaisa: moneyUtil.lineAmountPaisa(l.kg, item.rate_snapshot) };
        }
        if (l.quotedAmount === undefined || l.quotedAmount === null) {
          throw AppError.validation(`${l.categoryCode} is priced on inspection: enter the amount you are offering.`);
        }
        return { item, kg: l.kg, rate: null, amountPaisa: moneyUtil.toPaisa(l.quotedAmount) };
      });

      if (scalePhotoId && !(await this.photosRepository.lockUnused(tx, scalePhotoId))) {
        throw AppError.scalePhotoRequired('This scale photo was already used. Take a new one, or send the weights without a photo.');
      }

      const version = await this.weighingRepository.nextVersion(tx, pickupId);
      for (const l of lines) {
        await this.weighingRepository.insertLine(tx, {
          pickupId,
          categoryId: l.item.category_id,
          version,
          kg: moneyUtil.tenthsToDb(moneyUtil.toTenths(l.kg)),
          rate: l.rate,
          amount: moneyUtil.paisaToDb(l.amountPaisa),
          createdBy: actor.id,
          at: now,
        });
      }
      if (scalePhotoId) await this.photosRepository.attachToWeigh(tx, scalePhotoId, version);

      const totalKg = moneyUtil.tenthsToDb(lines.reduce((s, l) => s + moneyUtil.toTenths(l.kg), 0));
      const totalAmount = moneyUtil.paisaToDb(lines.reduce((s, l) => s + l.amountPaisa, 0));
      await this.pickupStateService.transition(
        tx,
        p,
        'WEIGHED',
        actor,
        { weighed_at: now, total_kg: totalKg, total_amount: totalAmount },
        { version, totalKg, totalAmount },
      );

      let closed: string | null = null;
      if (open) {
        await this.disputesRepository.resolve(tx, open.id, 'REWEIGHED', `Re-weighed: ${totalKg} kg, ${totalAmount} taka`, actor.id, now);
        closed = open.id;
      }
      return { p, closed };
    });

    this.pickupEventsService.changed('pickup.weighed', outcome.p, 'WEIGHED', now);
    if (outcome.closed) {
      const d = await this.disputesRepository.byId(outcome.closed);
      if (d) this.pickupEventsService.dispute('dispute.resolved', d, outcome.p);
    }
    return this.pickupViewsService.view(pickupId, actor);
  }

  /**
   * The pickup's items for these codes. A code the household did not list is added to the pickup
   * (found at the door) with the rate in effect now; unknown or inactive codes are refused.
   */
  private async itemsForLines(tx: Db, pickupId: string, codes: string[], now: Date): Promise<Map<string, WeighItemRow>> {
    const items = await this.weighingRepository.itemsOf(tx, pickupId);
    const byCode = new Map(items.map((i) => [i.code, i]));
    const extraCodes = [...new Set(codes.filter((c) => !byCode.has(c)))];
    if (extraCodes.length === 0) return byCode;

    const found = await this.weighingRepository.activeCategoriesWithRate(tx, extraCodes, dhakaToday(now));
    for (const code of extraCodes) {
      const extra = found.find((f) => f.code === code);
      if (!extra) throw AppError.validation(`${code} is not a category BhangariWala buys.`, { categoryCode: code });
      if (extra.pricing_type === 'PER_KG' && extra.rate_snapshot === null) {
        throw AppError.validation(`${code} has no rate yet, so it cannot be bought today.`, { categoryCode: code });
      }
      await this.weighingRepository.addItem(tx, pickupId, extra.category_id, extra.rate_snapshot);
      byCode.set(code, extra);
    }
    return byCode;
  }

  /** The household approves the weights and picks how to be paid. */
  async confirm(household: Viewer, pickupId: string, method: PaymentMethod, walletNumber?: string): Promise<PickupDto> {
    if (method !== 'CASH' && !walletNumber) {
      throw AppError.validation(`Enter the ${method === 'BKASH' ? 'bKash' : 'Nagad'} number to receive the money on.`);
    }
    const now = this.clock.now();
    const p = await this.pickupsRepository.transaction(async (tx) => {
      const locked = await this.pickupStateService.lockFor(tx, pickupId, household, false);
      await this.pickupStateService.transition(
        tx,
        locked,
        'CONFIRMED',
        household,
        { confirmed_at: now, payment_method: method, wallet_number: method === 'CASH' ? null : walletNumber },
        { paymentMethod: method },
      );
      return locked;
    });
    this.pickupEventsService.changed('pickup.confirmed', p, 'CONFIRMED', now);
    return this.pickupViewsService.view(pickupId, household);
  }

  /**
   * The collector records the payment: CONFIRMED -> COMPLETED. After an admin's PAY_AGAIN
   * decision the collector records a new TrxID on the COMPLETED pickup.
   */
  async recordPayment(collector: Viewer, pickupId: string, input: RecordPaymentDto): Promise<PickupDto> {
    const now = this.clock.now();
    const trxId = input.method === 'CASH' ? null : input.trxId?.trim().toUpperCase() || null;
    if (input.method !== 'CASH' && !trxId) throw AppError.trxIdRequired();

    let p: LockedPickup;
    try {
      p = await this.pickupsRepository.transaction(async (tx) => {
        const locked = await this.pickupStateService.lockFor(tx, pickupId, collector, false);
        if (trxId && (await this.paymentsRepository.trxIdUsedElsewhere(tx, input.method, trxId, pickupId))) {
          throw AppError.trxIdReused();
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
        await this.pickupStateService.transition(tx, locked, 'COMPLETED', collector, { completed_at: now }, { method: input.method, trxId });
        await this.paymentsRepository.insertPaid(tx, {
          pickupId,
          method: input.method,
          amount: locked.total_amount,
          walletNumber: locked.wallet_number,
          trxId,
          at: now,
        });
        return locked;
      });
    } catch (error) {
      if (isUniqueViolation(error, 'payments_trx_once')) throw AppError.trxIdReused();
      throw error;
    }
    this.pickupEventsService.changed('pickup.paid', p, 'COMPLETED', now);
    return this.pickupViewsService.view(pickupId, collector);
  }

  private async payAgain(tx: Db, p: LockedPickup, method: PaymentMethod, trxId: string | null, now: Date): Promise<void> {
    const payment = await this.paymentsRepository.lockForPickup(tx, p.id);
    const last = await this.disputesRepository.latestOfType(tx, p.id, 'PAYMENT');
    if (payment?.status !== 'REPORTED' || last?.status !== 'RESOLVED' || last.resolution !== 'PAY_AGAIN') {
      throw AppError.invalidState('This pickup is already paid.', { status: p.status });
    }
    if (method !== payment.method) {
      throw AppError.validation(`Pay again with ${payment.method}, the method the household chose.`);
    }
    if (trxId !== null && trxId === payment.trx_id) throw AppError.trxIdReused();
    await this.paymentsRepository.markPaidAgain(tx, p.id, trxId, now);
  }
}
