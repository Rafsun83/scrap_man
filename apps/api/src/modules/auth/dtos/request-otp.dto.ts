import { z } from 'zod';
import { phoneDto } from './phone.dto.js';

/** Body of POST /auth/otp/request. */
export const requestOtpDto = z.object({ phone: phoneDto });

export type RequestOtpDto = z.infer<typeof requestOtpDto>;
