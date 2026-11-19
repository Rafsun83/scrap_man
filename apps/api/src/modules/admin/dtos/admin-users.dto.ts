import { z } from 'zod';
import { USER_STATUSES, type Role, type UserStatus, type VerificationStatus, type WorkArea } from '@bw/shared';
import type { Language } from '../../users/enums/language.enum.js';

/** Query of GET /admin/users. */
export const listAdminUsersDto = z.object({
  role: z.enum(['HOUSEHOLD', 'COLLECTOR']),
  q: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
});

export type ListAdminUsersDto = z.infer<typeof listAdminUsersDto>;

/** Path of /admin/users/{userId}/status. */
export const adminUserIdDto = z.object({ userId: z.uuid() });

export type AdminUserIdDto = z.infer<typeof adminUserIdDto>;

/** Body of PUT /admin/users/{userId}/status. */
export const setUserStatusDto = z.object({
  status: z.enum(USER_STATUSES),
  note: z.string().trim().max(500).optional(),
});

export type SetUserStatusDto = z.infer<typeof setUserStatusDto>;

/** The contract's AdminUserRow (A5). */
export interface AdminUserRowDto {
  id: string;
  phone: string;
  role: Role;
  name: string | null;
  language: Language;
  status: UserStatus;
  statusNote: string | null;
  createdAt: string;
  releaseFlag: boolean;
  household: { area: string | null; completedCount: number; totalReceived: number; noShows30d: number } | null;
  collector: {
    workAreas: WorkArea[];
    ratingAvg: number | null;
    pickups30d: number;
    releases30d: number;
    verificationStatus: VerificationStatus;
    isOnline: boolean;
  } | null;
}

/** The contract's AdminUserPage. */
export interface AdminUserPageDto {
  items: AdminUserRowDto[];
  nextCursor: string | null;
}
