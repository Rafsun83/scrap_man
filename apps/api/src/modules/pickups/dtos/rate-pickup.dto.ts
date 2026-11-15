import { z } from 'zod';

/** Body of POST /pickups/{id}/rating. */
export const ratePickupDto = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().trim().max(300).optional(),
});

export type RatePickupDto = z.infer<typeof ratePickupDto>;
