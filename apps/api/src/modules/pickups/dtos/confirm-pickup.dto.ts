import { z } from 'zod';
import { PAYMENT_METHODS } from '@bw/shared';

const phone = z.string().regex(/^\+8801[3-9][0-9]{8}$/, 'Use a Bangladesh mobile number like +8801712345678.');

/** Body of POST /pickups/{id}/confirm. */
export const confirmPickupDto = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS),
  walletNumber: phone.optional(),
});

export type ConfirmPickupDto = z.infer<typeof confirmPickupDto>;
