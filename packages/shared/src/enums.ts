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

/** Socket.IO event names; payloads are the Event* schemas in docs/version-0/openapi.yaml. */
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
  'collector.verification',
  'collector.applied',
  'ops.alert',
  'rates.published',
] as const;
export type SocketEvent = (typeof SOCKET_EVENTS)[number];

export const VERIFICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VEHICLE_TYPES = ['VAN', 'PUSHCART', 'ON_FOOT'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

/** Dhaka areas a collector can work in (contract WorkArea), in the order the sign-up screen shows them. */
export const WORK_AREAS = [
  { code: 'MIRPUR', bn: 'মিরপুর', en: 'Mirpur' },
  { code: 'PALLABI', bn: 'পল্লবী', en: 'Pallabi' },
  { code: 'KAFRUL', bn: 'কাফরুল', en: 'Kafrul' },
  { code: 'SHYAMOLI', bn: 'শ্যামলী', en: 'Shyamoli' },
  { code: 'MOHAMMADPUR', bn: 'মোহাম্মদপুর', en: 'Mohammadpur' },
  { code: 'ADABOR', bn: 'আদাবর', en: 'Adabor' },
  { code: 'SHER_E_BANGLA_NAGAR', bn: 'শেরেবাংলা নগর', en: 'Sher-e-Bangla Nagar' },
  { code: 'DHANMONDI', bn: 'ধানমন্ডি', en: 'Dhanmondi' },
  { code: 'KALABAGAN', bn: 'কলাবাগান', en: 'Kalabagan' },
  { code: 'NEW_MARKET', bn: 'নিউ মার্কেট', en: 'New Market' },
  { code: 'HAZARIBAGH', bn: 'হাজারীবাগ', en: 'Hazaribagh' },
  { code: 'LALBAGH', bn: 'লালবাগ', en: 'Lalbagh' },
  { code: 'KAMRANGIRCHAR', bn: 'কামরাঙ্গীরচর', en: 'Kamrangirchar' },
  { code: 'CHAWKBAZAR', bn: 'চকবাজার', en: 'Chawkbazar' },
  { code: 'KOTWALI', bn: 'কোতোয়ালী', en: 'Kotwali' },
  { code: 'SUTRAPUR', bn: 'সূত্রাপুর', en: 'Sutrapur' },
  { code: 'WARI', bn: 'ওয়ারী', en: 'Wari' },
  { code: 'GENDARIA', bn: 'গেন্ডারিয়া', en: 'Gendaria' },
  { code: 'SHYAMPUR', bn: 'শ্যামপুর', en: 'Shyampur' },
  { code: 'KADAMTALI', bn: 'কদমতলী', en: 'Kadamtali' },
  { code: 'JATRABARI', bn: 'যাত্রাবাড়ী', en: 'Jatrabari' },
  { code: 'DEMRA', bn: 'ডেমরা', en: 'Demra' },
  { code: 'SABUJBAGH', bn: 'সবুজবাগ', en: 'Sabujbagh' },
  { code: 'MUGDA', bn: 'মুগদা', en: 'Mugda' },
  { code: 'MOTIJHEEL', bn: 'মতিঝিল', en: 'Motijheel' },
  { code: 'PALTAN', bn: 'পল্টন', en: 'Paltan' },
  { code: 'RAMNA', bn: 'রমনা', en: 'Ramna' },
  { code: 'SHAHBAGH', bn: 'শাহবাগ', en: 'Shahbagh' },
  { code: 'KHILGAON', bn: 'খিলগাঁও', en: 'Khilgaon' },
  { code: 'RAMPURA', bn: 'রামপুরা', en: 'Rampura' },
  { code: 'TEJGAON', bn: 'তেজগাঁও', en: 'Tejgaon' },
  { code: 'BADDA', bn: 'বাড্ডা', en: 'Badda' },
  { code: 'GULSHAN', bn: 'গুলশান', en: 'Gulshan' },
  { code: 'BANANI', bn: 'বনানী', en: 'Banani' },
  { code: 'VATARA', bn: 'ভাটারা', en: 'Vatara' },
  { code: 'CANTONMENT', bn: 'ক্যান্টনমেন্ট', en: 'Cantonment' },
  { code: 'BHASANTEK', bn: 'ভাসানটেক', en: 'Bhasantek' },
  { code: 'KHILKHET', bn: 'খিলক্ষেত', en: 'Khilkhet' },
  { code: 'UTTARA', bn: 'উত্তরা', en: 'Uttara' },
  { code: 'UTTARKHAN', bn: 'উত্তরখান', en: 'Uttarkhan' },
  { code: 'DAKSHINKHAN', bn: 'দক্ষিণখান', en: 'Dakshinkhan' },
  { code: 'TURAG', bn: 'তুরাগ', en: 'Turag' },
  { code: 'SHAH_ALI', bn: 'শাহ আলী', en: 'Shah Ali' },
] as const;
export type WorkArea = (typeof WORK_AREAS)[number]['code'];
export const WORK_AREA_CODES = WORK_AREAS.map((a) => a.code) as readonly WorkArea[];
/** A collector picks between 1 and this many work areas. */
export const MAX_WORK_AREAS = 10;

/** The collector ledger covers at most this many days per request. */
export const LEDGER_MAX_DAYS = 92;

/** When the admin panel (A1, A5) asks operations to look at something. */
export const ADMIN_ATTENTION = {
  /** A request still waiting for a collector this long after it was made. */
  waitingMinutes: 60,
  /** A collector who gave back more requests than this in 30 days is flagged. */
  maxReleases30d: 5,
} as const;

export const USER_STATUSES = ['ACTIVE', 'FLAGGED', 'SUSPENDED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Ops alert thresholds (GET /admin/alerts, the `alert` log lines). */
export const OPS_ALERTS = {
  /** An ACCEPTED pickup this long after its slot ended. */
  acceptedPastSlotMinutes: 60,
  /** A CONFIRMED pickup still unpaid after this long. */
  confirmedUnpaidMinutes: 120,
  /** A dispute with staff (ADMIN_REVIEW) longer than this. */
  reviewOverdueHours: 24,
  /** More wrong OTP codes than this in the window, across all phones. */
  otpFailures: 20,
  otpWindowMinutes: 10,
  /** PAYMENT_REPORTED and NO_SHOW alerts last this long. */
  recentHours: 24,
} as const;

/** A collector may report a household not home only this close to the address. */
export const NO_SHOW_MAX_DISTANCE_M = 200;

export const DEVICE_PLATFORMS = ['ANDROID', 'IOS'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];
