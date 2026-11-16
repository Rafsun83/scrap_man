import { z } from 'zod';
import { LEDGER_MAX_DAYS, type PaymentMethod } from '@bw/shared';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-16.')
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), {
    message: 'That date does not exist.',
  });

const dayNumber = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;

/** Query of GET /collector/ledger: Dhaka dates, inclusive. */
export const ledgerQueryDto = z
  .object({ from: isoDate, to: isoDate })
  .refine((q) => q.from <= q.to, { message: 'from must be on or before to.', path: ['from'] })
  .refine((q) => dayNumber(q.to) - dayNumber(q.from) < LEDGER_MAX_DAYS, {
    message: `Ask for at most ${LEDGER_MAX_DAYS} days at a time.`,
    path: ['to'],
  });

export type LedgerQueryDto = z.infer<typeof ledgerQueryDto>;

/** The contract's Ledger. */
export interface LedgerDto {
  from: string;
  to: string;
  totalPaid: number;
  totalKg: number;
  pickupCount: number;
  byMethod: Record<PaymentMethod, number>;
  byCategory: { categoryCode: string; kg: number }[];
  payments: {
    pickupId: string;
    householdName: string | null;
    method: PaymentMethod;
    trxId: string | null;
    amount: number;
    paidAt: string;
  }[];
}
