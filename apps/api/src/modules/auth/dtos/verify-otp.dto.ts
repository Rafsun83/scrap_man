import { z } from 'zod';
import { phoneDto } from './phone.dto.js';

/** Body of POST /auth/otp/verify. */
export const verifyOtpDto = z.object({
  phone: phoneDto,
  code: z.string().regex(/^[0-9]{6}$/, 'The code has 6 digits.'),
  role: z.enum(['HOUSEHOLD', 'COLLECTOR']),
});

export type VerifyOtpDto = z.infer<typeof verifyOtpDto>;
