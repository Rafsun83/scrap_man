import { z } from 'zod';

/** Dhaka-area addresses only for v1: a loose box around Bangladesh catches swapped lat/lng. */
const latLng = z.object({
  lat: z.number().min(20.5).max(26.7),
  lng: z.number().min(88).max(92.7),
});

export const addressInputSchema = z.object({
  label: z.string().trim().min(1).max(40),
  line: z.string().trim().min(1).max(200),
  area: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(40).optional(),
  location: latLng,
  note: z.string().trim().max(200).optional(),
  isDefault: z.boolean().optional(),
});

export const addressPatchSchema = addressInputSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Send at least one field to change.',
});

export const profilePatchSchema = z
  .object({
    name: z.string().trim().max(80).optional(),
    language: z.enum(['BN', 'EN']).optional(),
  })
  .refine((v) => v.name !== undefined || v.language !== undefined, {
    message: 'Send a name or a language.',
  });

export const uuidSchema = z.uuid();
