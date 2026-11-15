import { z } from 'zod';
import { latLngSchema } from '../../../common/geo.js';

/** Body of PUT /collector/status. */
export const collectorStatusDto = z.object({ online: z.boolean(), location: latLngSchema.optional() });

export type CollectorStatusDto = z.infer<typeof collectorStatusDto>;

/** Body of PUT /collector/location. */
export const collectorLocationDto = latLngSchema;

export type CollectorLocationDto = z.infer<typeof collectorLocationDto>;

/** Query of GET /collector/requests/nearby (query strings arrive as text). */
export const nearbyQueryDto = z.object({
  lat: z.coerce.number().min(20.5).max(26.7),
  lng: z.coerce.number().min(88).max(92.7),
});

export type NearbyQueryDto = z.infer<typeof nearbyQueryDto>;
