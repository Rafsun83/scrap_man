/** users.status (Postgres enum user_status). */
export const USER_STATUSES = ['ACTIVE', 'FLAGGED', 'SUSPENDED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
