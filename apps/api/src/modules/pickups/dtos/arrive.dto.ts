import { z } from 'zod';

/** Body of POST /pickups/{id}/arrive. */
export const arriveDto = z.object({ code: z.string().regex(/^[0-9]{4}$/, 'The pickup code is 4 digits.') });

export type ArriveDto = z.infer<typeof arriveDto>;
