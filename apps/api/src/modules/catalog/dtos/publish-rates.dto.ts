import { z } from 'zod';

/** Body of PUT /admin/rates. */
export const publishRatesDto = z.object({
  effectiveDate: z.iso.date(),
  rates: z
    .array(
      z.object({
        categoryCode: z.string().min(1).max(30),
        ratePerKg: z.number().positive().max(100_000).multipleOf(0.01),
      }),
    )
    .min(1),
});

export type PublishRatesDto = z.infer<typeof publishRatesDto>;
