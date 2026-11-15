import { z } from 'zod';
import { moneyUtil } from '../utils/money.util.js';

const kg = z
  .number()
  .positive()
  .max(1000)
  .refine((n) => moneyUtil.hasAtMostDecimals(n, 1), 'Weigh to 0.1 kg.');
const money = z
  .number()
  .min(0)
  .max(1_000_000)
  .refine((n) => moneyUtil.hasAtMostDecimals(n, 2), 'Use at most 2 decimals.');

/** Body of POST /pickups/{id}/weights. */
export const submitWeightsDto = z.object({
  lines: z
    .array(z.object({ categoryCode: z.string().min(1).max(30), kg, quotedAmount: money.nullable().optional() }))
    .min(1)
    .max(10),
  scalePhotoId: z.uuid(),
});

export type SubmitWeightsDto = z.infer<typeof submitWeightsDto>;
