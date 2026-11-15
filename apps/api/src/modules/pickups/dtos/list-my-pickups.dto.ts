import { z } from 'zod';

/** Query of GET /me/pickups. */
export const listMyPickupsDto = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
});

export type ListMyPickupsDto = z.infer<typeof listMyPickupsDto>;
