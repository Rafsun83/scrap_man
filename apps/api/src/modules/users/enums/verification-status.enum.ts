/** collector_profiles.verification_status (Postgres enum verification_status). */
export const VERIFICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
