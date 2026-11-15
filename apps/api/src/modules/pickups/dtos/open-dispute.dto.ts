import { z } from 'zod';
import { DISPUTE_TYPES } from '@bw/shared';

/** Body of POST /pickups/{id}/dispute. */
export const openDisputeDto = z.object({
  type: z.enum(DISPUTE_TYPES),
  reason: z.string().trim().max(500).optional(),
  photoIds: z.array(z.uuid()).max(5).optional(),
});

export type OpenDisputeDto = z.infer<typeof openDisputeDto>;
