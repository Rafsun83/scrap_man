/** users.language (Postgres enum app_language). */
export const LANGUAGES = ['BN', 'EN'] as const;
export type Language = (typeof LANGUAGES)[number];
