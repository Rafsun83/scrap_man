import { z } from 'zod';

/** Query for GET /me/notifications (the project validates with Zod and ZodPipe). */
export const listNotificationsDto = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
});

export type ListNotificationsDto = z.infer<typeof listNotificationsDto>;
