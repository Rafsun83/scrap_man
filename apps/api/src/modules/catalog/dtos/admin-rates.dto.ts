import { z } from 'zod';
import type { PricingType } from '../enums/pricing-type.enum.js';

/** Query of GET /admin/rates; today when left out. */
export const adminRatesQueryDto = z.object({ date: z.iso.date().optional() });

export type AdminRatesQueryDto = z.infer<typeof adminRatesQueryDto>;

/** The contract's AdminRates (A2). */
export interface AdminRatesDto {
  date: string;
  publishedAt: string | null;
  publishedByName: string | null;
  rates: {
    categoryCode: string;
    pricingType: PricingType;
    rate: number | null;
    previousRate: number | null;
    previousDate: string | null;
  }[];
}
