import { z } from 'zod';
import { PICKUP_STATUSES, type PickupStatus, type Role } from '@bw/shared';

/** Query of GET /admin/pickups. */
export const listAdminPickupsDto = z.object({
  status: z.enum(PICKUP_STATUSES).optional(),
  group: z.enum(['ACTIVE', 'WEIGHING', 'PAST']).optional(),
  area: z.string().trim().min(1).max(80).optional(),
  date: z.iso.date().optional(),
  q: z.string().trim().min(1).max(80).optional(),
  userId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
});

export type ListAdminPickupsDto = z.infer<typeof listAdminPickupsDto>;

/** The contract's PickupEvent (one line of the admin timeline). */
export interface PickupEventDto {
  id: string;
  at: string;
  from: PickupStatus | null;
  to: PickupStatus;
  actorRole: Role | null;
  actorName: string | null;
  meta: Record<string, unknown> | null;
}
