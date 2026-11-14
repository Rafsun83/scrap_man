import { z } from 'zod';
import { DISPUTE_OUTCOMES, DISPUTE_STATUSES, DISPUTE_TYPES, PAYMENT_METHODS, TIME_SLOTS, WEIGHT_BANDS } from '@bw/shared';
import { latLng } from '../users/schemas.js';
import { hasAtMostDecimals } from './money.js';

const phone = z.string().regex(/^\+8801[3-9][0-9]{8}$/, 'Use a Bangladesh mobile number like +8801712345678.');
const kg = z
  .number()
  .positive()
  .max(1000)
  .refine((n) => hasAtMostDecimals(n, 1), 'Weigh to 0.1 kg.');
const money = z
  .number()
  .min(0)
  .max(1_000_000)
  .refine((n) => hasAtMostDecimals(n, 2), 'Use at most 2 decimals.');

export const pickupIdSchema = z.uuid();

export const createPickupSchema = z.object({
  addressId: z.uuid(),
  categoryCodes: z.array(z.string().min(1).max(30)).min(1).max(10),
  weightBand: z.enum(WEIGHT_BANDS),
  slotDate: z.iso.date(),
  slot: z.enum(TIME_SLOTS),
  note: z.string().trim().max(200).optional(),
});

export const listMineSchema = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
});

export const reasonSchema = z.object({ reason: z.string().trim().max(200).optional() }).default({});

export const adminCancelSchema = z.object({ reason: z.string().trim().min(1).max(500) });

export const arriveSchema = z.object({ code: z.string().regex(/^[0-9]{4}$/, 'The pickup code is 4 digits.') });

export const photoSchema = z.object({
  kind: z.enum(['ITEMS', 'SCALE']),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
});

export const weightsSchema = z.object({
  lines: z
    .array(z.object({ categoryCode: z.string().min(1).max(30), kg, quotedAmount: money.nullable().optional() }))
    .min(1)
    .max(10),
  scalePhotoId: z.uuid(),
});

export const confirmSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS),
  walletNumber: phone.optional(),
});

export const disputeSchema = z.object({
  type: z.enum(DISPUTE_TYPES),
  reason: z.string().trim().max(500).optional(),
  photoIds: z.array(z.uuid()).max(5).optional(),
});

export const paymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  trxId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{6,30}$/, 'A TrxID is 6 to 30 letters and digits.')
    .optional(),
});

export const ratingSchema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().trim().max(300).optional(),
});

export const collectorStatusSchema = z.object({ online: z.boolean(), location: latLng.optional() });

export const locationSchema = latLng;

export const nearbySchema = z.object({ lat: z.coerce.number().min(20.5).max(26.7), lng: z.coerce.number().min(88).max(92.7) });

export const disputeListSchema = z.object({ status: z.enum(DISPUTE_STATUSES).optional() });

export const resolveSchema = z.object({
  outcome: z.enum(DISPUTE_OUTCOMES).refine((o) => o !== 'REWEIGHED', 'REWEIGHED is set by the system.'),
  note: z.string().trim().min(1).max(500),
});
