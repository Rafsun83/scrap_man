import { z } from 'zod';
import { latLngSchema } from '../../../common/geo.js';

/** Body of POST /me/addresses. */
export const addressInputDto = z.object({
  label: z.string().trim().min(1).max(40),
  line: z.string().trim().min(1).max(200),
  area: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(40).optional(),
  location: latLngSchema,
  note: z.string().trim().max(200).optional(),
  isDefault: z.boolean().optional(),
});

export type AddressInputDto = z.infer<typeof addressInputDto>;

/** Body of PATCH /me/addresses/{addressId}. */
export const addressPatchDto = addressInputDto.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Send at least one field to change.',
});

export type AddressPatchDto = z.infer<typeof addressPatchDto>;

/** Path parameter addressId. */
export const addressIdDto = z.uuid();
