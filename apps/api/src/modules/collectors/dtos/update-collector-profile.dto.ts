import { z } from 'zod';
import { VEHICLE_TYPES } from '@bw/shared';
import { workAreasSchema } from './collector-signup.dto.js';

/** Body of PATCH /collector/profile: at least one field. */
export const updateCollectorProfileDto = z
  .object({
    workAreas: workAreasSchema.optional(),
    vehicleType: z.enum(VEHICLE_TYPES).optional(),
    hasScale: z.boolean().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), 'Send at least one change.');

export type UpdateCollectorProfileDto = z.infer<typeof updateCollectorProfileDto>;
