import { z } from 'zod';
import { VERIFICATION_STATUSES } from '@bw/shared';

/** Path of /admin/collectors/{userId}/decision. */
export const collectorUserIdDto = z.object({ userId: z.uuid() });

export type CollectorUserIdDto = z.infer<typeof collectorUserIdDto>;

/** Body of POST /admin/collectors/{userId}/decision; rejecting needs a note the collector will read. */
export const collectorDecisionDto = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    note: z.string().trim().max(500).optional(),
  })
  .refine((b) => b.decision === 'APPROVED' || !!b.note, {
    message: 'Write a note telling the collector why the application was rejected.',
    path: ['note'],
  });

export type CollectorDecisionDto = z.infer<typeof collectorDecisionDto>;

/** Query of GET /admin/collectors. */
export const listCollectorsDto = z.object({
  status: z.enum(VERIFICATION_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
});

export type ListCollectorsDto = z.infer<typeof listCollectorsDto>;
