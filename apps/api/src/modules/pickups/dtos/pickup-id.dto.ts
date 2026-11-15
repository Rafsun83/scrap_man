import { z } from 'zod';

/** Path parameters pickupId and disputeId. */
export const pickupIdDto = z.uuid();
export const disputeIdDto = z.uuid();
