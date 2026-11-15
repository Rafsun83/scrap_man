import type { PricingType } from '../enums/pricing-type.enum.js';

/** The contract's Category. */
export interface CategoryDto {
  code: string;
  nameBn: string;
  nameEn: string;
  pricingType: PricingType;
  icon: string;
}
