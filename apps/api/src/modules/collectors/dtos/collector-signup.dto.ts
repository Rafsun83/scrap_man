import { z } from 'zod';
import { MAX_WORK_AREAS, VEHICLE_TYPES, WORK_AREA_CODES, type WorkArea } from '@bw/shared';

/** The contract's WorkAreas: 1 to 10 distinct Dhaka area codes. */
export const workAreasSchema = z
  .array(z.enum(WORK_AREA_CODES as [WorkArea, ...WorkArea[]]))
  .min(1, 'Pick at least one area you work in.')
  .max(MAX_WORK_AREAS, `Pick up to ${MAX_WORK_AREAS} areas.`)
  .refine((areas) => new Set(areas).size === areas.length, 'Each area can be picked once.');

/** Body of POST /collector/signup. */
export const collectorSignupDto = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80),
  nidNumber: z.string().regex(/^([0-9]{10}|[0-9]{13}|[0-9]{17})$/, 'An NID number has 10, 13 or 17 digits.'),
  selfiePhotoId: z.uuid(),
  workAreas: workAreasSchema,
  vehicleType: z.enum(VEHICLE_TYPES),
  hasScale: z.boolean(),
  acceptedAgreement: z.literal(true, 'Accept the collector agreement to apply.'),
});

export type CollectorSignupDto = z.infer<typeof collectorSignupDto>;
