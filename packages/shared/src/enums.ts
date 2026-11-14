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
  /** A collector with no location ping for this long is treated as offline. */
  onlineStaleAfterMs: 10 * 60 * 1000,
} as const;

/** Minimum estimated weight for a request, unless it includes electronics. */
export const MIN_PICKUP_KG = 2;

/** Booked slots in Dhaka local hours: [start, end). A request expires at the end of its slot. */
export const SLOT_HOURS: Record<TimeSlot, { start: number; end: number }> = {
  MORNING: { start: 9, end: 12 },
  MIDDAY: { start: 12, end: 15 },
  AFTERNOON: { start: 15, end: 18 },
};

/** A pickup can be booked for today and up to this many days ahead. */
export const BOOKING_DAYS_AHEAD = 2;

/**
 * Kg range behind each weight band, for the payout estimate. UNDER_5 means 2 to 5 kg because the
 * minimum request is 2 kg; OVER_15 is capped at 30 kg for the estimate only.
 */
export const WEIGHT_BAND_KG: Record<WeightBand, { min: number; max: number }> = {
  UNDER_5: { min: 2, max: 5 },
  FROM_5_TO_15: { min: 5, max: 15 },
  OVER_15: { min: 15, max: 30 },
  UNSURE: { min: 2, max: 15 },
};

/** Wrong pickup codes allowed before the pickup locks and an admin is alerted. */
export const PICKUP_CODE_MAX_ATTEMPTS = 5;

export const DISPUTE_TYPES = ['WEIGHT', 'PAYMENT', 'BEHAVIOUR', 'OTHER'] as const;
export type DisputeType = (typeof DISPUTE_TYPES)[number];

export const DISPUTE_STATUSES = ['REWEIGH', 'ADMIN_REVIEW', 'RESOLVED'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const DISPUTE_OUTCOMES = [
  'REWEIGHED',
  'ACCEPT_WEIGHTS',
  'TEAM_REWEIGH',
  'CANCEL',
  'PAYMENT_VERIFIED',
  'PAY_AGAIN',
  'SUSPEND_COLLECTOR',
  'NO_ACTION',
] as const;
export type DisputeOutcome = (typeof DISPUTE_OUTCOMES)[number];

/** Outcomes an admin may pick for each dispute type (REWEIGHED is set by the system). */
export const OUTCOMES_BY_DISPUTE_TYPE: Record<DisputeType, readonly DisputeOutcome[]> = {
  WEIGHT: ['ACCEPT_WEIGHTS', 'TEAM_REWEIGH', 'CANCEL'],
  PAYMENT: ['PAYMENT_VERIFIED', 'PAY_AGAIN', 'SUSPEND_COLLECTOR'],
  BEHAVIOUR: ['NO_ACTION', 'SUSPEND_COLLECTOR', 'CANCEL'],
  OTHER: ['NO_ACTION', 'SUSPEND_COLLECTOR', 'CANCEL'],
};

/** Socket.IO event names; payloads are the Event* schemas in docs/openapi.yaml. */
export const SOCKET_EVENTS = [
  'request.created',
  'request.taken',
  'request.expired',
  'pickup.accepted',
  'pickup.released',
  'collector.location',
  'pickup.arrived',
  'pickup.code_locked',
  'pickup.weighed',
  'pickup.confirmed',
  'pickup.disputed',
  'pickup.paid',
  'pickup.cancelled',
  'dispute.opened',
  'dispute.resolved',
] as const;
export type SocketEvent = (typeof SOCKET_EVENTS)[number];
