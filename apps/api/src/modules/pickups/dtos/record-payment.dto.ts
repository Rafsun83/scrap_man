import { z } from 'zod';
import { PAYMENT_METHODS } from '@bw/shared';

/** Body of POST /pickups/{id}/payment. */
export const recordPaymentDto = z.object({
  method: z.enum(PAYMENT_METHODS),
  trxId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{6,30}$/, 'A TrxID is 6 to 30 letters and digits.')
    .optional(),
});

export type RecordPaymentDto = z.infer<typeof recordPaymentDto>;
