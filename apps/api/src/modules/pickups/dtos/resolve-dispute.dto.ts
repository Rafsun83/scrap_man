import { z } from 'zod';
import { DISPUTE_OUTCOMES } from '@bw/shared';

/** Body of POST /admin/disputes/{id}/resolve. */
export const resolveDisputeDto = z.object({
  outcome: z.enum(DISPUTE_OUTCOMES).refine((o) => o !== 'REWEIGHED', 'REWEIGHED is set by the system.'),
  note: z.string().trim().min(1).max(500),
});

export type ResolveDisputeDto = z.infer<typeof resolveDisputeDto>;
