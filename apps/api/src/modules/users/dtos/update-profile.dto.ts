import { z } from 'zod';
import { LANGUAGES } from '../enums/language.enum.js';

/** Body of PATCH /me. */
export const updateProfileDto = z
  .object({
    name: z.string().trim().max(80).optional(),
    language: z.enum(LANGUAGES).optional(),
  })
  .refine((v) => v.name !== undefined || v.language !== undefined, {
    message: 'Send a name or a language.',
  });

export type UpdateProfileDto = z.infer<typeof updateProfileDto>;
