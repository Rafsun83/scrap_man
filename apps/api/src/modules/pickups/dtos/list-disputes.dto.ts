import { z } from 'zod';
import { DISPUTE_STATUSES, DISPUTE_TYPES } from '@bw/shared';

/** Query of GET /admin/disputes. */
export const listDisputesDto = z.object({ status: z.enum(DISPUTE_STATUSES).optional(), type: z.enum(DISPUTE_TYPES).optional() });

export type ListDisputesDto = z.infer<typeof listDisputesDto>;
