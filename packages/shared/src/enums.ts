/** Runtime lists for the API enums, for dropdowns, filters and validation. */
export const PICKUP_STATUSES = [
  'REQUESTED',
  'ACCEPTED',
  'ARRIVED',
  'WEIGHED',
  'DISPUTED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
] as const;
export type PickupStatus = (typeof PICKUP_STATUSES)[number];

export const ACTIVE_PICKUP_STATUSES: readonly PickupStatus[] = [
  'REQUESTED',
  'ACCEPTED',
  'ARRIVED',
  'WEIGHED',
  'DISPUTED',
  'CONFIRMED',
];

export const TIME_SLOTS = ['MORNING', 'MIDDAY', 'AFTERNOON'] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];

export const WEIGHT_BANDS = ['UNDER_5', 'FROM_5_TO_15', 'OVER_15', 'UNSURE'] as const;
export type WeightBand = (typeof WEIGHT_BANDS)[number];

export const PAYMENT_METHODS = ['CASH', 'BKASH', 'NAGAD'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ROLES = ['HOUSEHOLD', 'COLLECTOR', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** Matching rules from the spec: start at 1 km, widen to 3 km after 5 minutes. */
export const MATCHING = {
  initialRadiusM: 1000,
  widenedRadiusM: 3000,
  widenAfterMs: 5 * 60 * 1000,
} as const;

/** Minimum estimated weight for a request, unless it includes electronics. */
export const MIN_PICKUP_KG = 2;
