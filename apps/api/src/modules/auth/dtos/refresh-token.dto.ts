import { z } from 'zod';

/** Body of POST /auth/refresh and POST /auth/logout. */
export const refreshTokenDto = z.object({ refreshToken: z.string().min(20) });

export type RefreshTokenDto = z.infer<typeof refreshTokenDto>;
