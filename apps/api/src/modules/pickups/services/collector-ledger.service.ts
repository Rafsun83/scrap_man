import { Inject, Injectable } from '@nestjs/common';
import { PAYMENT_METHODS, type PaymentMethod } from '@bw/shared';
import { CLOCK, type Clock } from '../../../common/clock.js';
import type { LedgerDto, LedgerQueryDto } from '../dtos/ledger.dto.js';
import { LedgerRepository } from '../repositories/ledger.repository.js';
import { moneyUtil } from '../utils/money.util.js';

/** A collector's paid pickups for a date range, and their recent activity for the profile. */
@Injectable()
export class CollectorLedgerService {
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async ledger(collectorId: string, range: LedgerQueryDto): Promise<LedgerDto> {
    const [payments, categories] = await Promise.all([
      this.ledgerRepository.payments(collectorId, range.from, range.to),
      this.ledgerRepository.byCategory(collectorId, range.from, range.to),
    ]);
    const byMethodPaisa = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, 0])) as Record<PaymentMethod, number>;
    let paidPaisa = 0;
    let kgTenths = 0;
    for (const p of payments) {
      const paisa = moneyUtil.toPaisa(p.amount);
      paidPaisa += paisa;
      byMethodPaisa[p.method] += paisa;
      kgTenths += moneyUtil.toTenths(p.total_kg ?? 0);
    }
    return {
      from: range.from,
      to: range.to,
      totalPaid: paidPaisa / 100,
      totalKg: kgTenths / 10,
      pickupCount: payments.length,
      byMethod: Object.fromEntries(PAYMENT_METHODS.map((m) => [m, byMethodPaisa[m] / 100])) as Record<PaymentMethod, number>,
      byCategory: categories.map((c) => ({ categoryCode: c.code, kg: moneyUtil.toTenths(c.kg) / 10 })),
      payments: payments.map((p) => ({
        pickupId: p.pickup_id,
        householdName: p.household_name,
        method: p.method,
        trxId: p.trx_id,
        amount: Number(p.amount),
        paidAt: p.paid_at.toISOString(),
      })),
    };
  }

  /** Pickups completed and requests given back in the last 30 days (CollectorProfile). */
  async recentActivity(collectorId: string): Promise<{ pickups30d: number; releases30d: number }> {
    const row = await this.ledgerRepository.stats30d(collectorId, this.clock.now());
    return { pickups30d: row.pickups_30d, releases30d: row.releases_30d };
  }
}
