import { z } from 'zod';
import { DISPUTE_STATUSES } from '@bw/shared';

/** Query of GET /admin/disputes. */
export const listDisputesDto = z.object({ status: z.enum(DISPUTE_STATUSES).optional() });

export type ListDisputesDto = z.infer<typeof listDisputesDto>;
