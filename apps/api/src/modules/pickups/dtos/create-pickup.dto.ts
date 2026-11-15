import { z } from 'zod';
import { TIME_SLOTS, WEIGHT_BANDS } from '@bw/shared';

/** Body of POST /pickups. */
export const createPickupDto = z.object({
  addressId: z.uuid(),
  categoryCodes: z.array(z.string().min(1).max(30)).min(1).max(10),
  weightBand: z.enum(WEIGHT_BANDS),
  slotDate: z.iso.date(),
  slot: z.enum(TIME_SLOTS),
  note: z.string().trim().max(200).optional(),
});

export type CreatePickupDto = z.infer<typeof createPickupDto>;
