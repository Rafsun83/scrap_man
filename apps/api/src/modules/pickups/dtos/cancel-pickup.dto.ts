import { z } from 'zod';

/** Body of POST /pickups/{id}/cancel and /release: an optional reason. */
export const reasonDto = z.object({ reason: z.string().trim().max(200).optional() }).default({});

export type ReasonDto = z.infer<typeof reasonDto>;

/** Body of POST /admin/pickups/{id}/cancel: admins must say why. */
export const adminCancelDto = z.object({ reason: z.string().trim().min(1).max(500) });

export type AdminCancelDto = z.infer<typeof adminCancelDto>;
