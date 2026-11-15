import { Injectable } from '@nestjs/common';
import type { PaymentMethod } from '@bw/shared';
import { one, rows, type Db } from '../../../common/sql.js';

export interface PaymentInput {
  pickupId: string;
  method: PaymentMethod;
  amount: string | null;
  walletNumber: string | null;
  trxId: string | null;
  at: Date;
}

/** Payments: one per pickup; a TrxID is used once per method. */
@Injectable()
export class PaymentsRepository {
  async trxIdUsedElsewhere(tx: Db, method: PaymentMethod, trxId: string, pickupId: string): Promise<boolean> {
    const used = await one(tx, `SELECT 1 FROM payments WHERE method = $1 AND trx_id = $2 AND pickup_id <> $3`, [
      method,
      trxId,
      pickupId,
    ]);
    return used !== null;
  }

  async insertPaid(tx: Db, p: PaymentInput): Promise<void> {
    await tx.query(
      `INSERT INTO payments (pickup_id, method, amount, wallet_number, trx_id, status, paid_at)
       VALUES ($1, $2, $3, $4, $5, 'PAID', $6)`,
      [p.pickupId, p.method, p.amount, p.walletNumber, p.trxId, p.at],
    );
  }

  lockForPickup(tx: Db, pickupId: string): Promise<{ method: PaymentMethod; status: string; trx_id: string | null } | null> {
    return one(tx, `SELECT method, status, trx_id FROM payments WHERE pickup_id = $1 FOR UPDATE`, [pickupId]);
  }

  /** Records the new TrxID after a PAY_AGAIN decision. */
  async markPaidAgain(tx: Db, pickupId: string, trxId: string | null, at: Date): Promise<void> {
    await tx.query(`UPDATE payments SET trx_id = $2, status = 'PAID', paid_at = $3 WHERE pickup_id = $1`, [pickupId, trxId, at]);
  }

  /** PAID -> REPORTED; false when there is no PAID payment. */
  async markReported(tx: Db, pickupId: string): Promise<boolean> {
    const paid = await rows<{ pickup_id: string }>(
      tx,
      `UPDATE payments SET status = 'REPORTED' WHERE pickup_id = $1 AND status = 'PAID' RETURNING pickup_id`,
      [pickupId],
    );
    return paid.length > 0;
  }

  async markVerified(tx: Db, pickupId: string): Promise<void> {
    await tx.query(`UPDATE payments SET status = 'VERIFIED' WHERE pickup_id = $1`, [pickupId]);
  }
}
