/** categories.pricing_type (Postgres enum pricing_type). Electronics are priced on inspection. */
export const PRICING_TYPES = ['PER_KG', 'ON_INSPECTION'] as const;
export type PricingType = (typeof PRICING_TYPES)[number];
