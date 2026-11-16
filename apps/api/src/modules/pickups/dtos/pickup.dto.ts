import type { PaymentMethod, PickupStatus, TimeSlot, WeightBand } from '@bw/shared';
import type { DisputeDto } from './dispute.dto.js';

export interface PayoutEstimateDto {
  min: number;
  max: number;
}

export interface WeighLineDto {
  categoryCode: string;
  kg: number;
  rate: number | null;
  amount: number;
}

export interface WeighRoundDto {
  version: number;
  lines: WeighLineDto[];
  totalKg: number;
  totalAmount: number;
  scalePhotoId: string | null;
  weighedBy: 'ADMIN' | 'COLLECTOR';
  createdAt: string;
}

export interface PickupPhotoDto {
  id: string;
  kind: 'ITEMS' | 'SCALE';
  weighVersion: number | null;
  url: string;
  createdAt: string;
}

export interface PaymentDto {
  method: PaymentMethod;
  amount: number;
  walletNumber: string | null;
  trxId: string | null;
  status: 'PAID' | 'REPORTED' | 'VERIFIED';
  paidAt: string;
}

/**
 * The contract's Pickup, as one viewer may see it. Fields the viewer may not see are null:
 * the exact address and household phone only reach the assigned collector after accept,
 * and the pickup code only reaches the household while ACCEPTED.
 */
export interface PickupDto {
  id: string;
  displayNo: string;
  status: PickupStatus;
  slotDate: string;
  slot: TimeSlot;
  weightBand: WeightBand;
  categoryCodes: string[];
  area: string;
  estimate: PayoutEstimateDto | null;
  address: { text: string; lat: number; lng: number; note: string | null } | null;
  household: { id: string; name: string | null; phone: string | null };
  collector: { id: string; name: string | null; rating: number | null; phone: string | null } | null;
  pickupCode: string | null;
  codeLocked: boolean;
  lines: WeighLineDto[];
  weighVersion: number | null;
  weighRounds: WeighRoundDto[];
  photos: PickupPhotoDto[];
  totalKg: number | null;
  totalAmount: number | null;
  paymentMethod: PaymentMethod | null;
  walletNumber: string | null;
  payment: PaymentDto | null;
  openDispute: DisputeDto | null;
  searchRadiusM: number;
  requestedAt: string;
  acceptedAt: string | null;
  arrivedAt: string | null;
  weighedAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  expiresAt: string;
  collectorLocation: { lat: number; lng: number; at: string } | null;
  rating: { stars: number; comment: string | null; createdAt: string } | null;
  lockedRates: LockedRateDto[] | null;
}

/** A rate copied onto one item of the pickup (null for ON_INSPECTION categories). */
export interface LockedRateDto {
  categoryCode: string;
  rate: number | null;
}

/** The contract's PickupPage. */
export interface PickupPageDto {
  items: PickupDto[];
  nextCursor: string | null;
}

/** The contract's MeSummary (H11). */
export interface PickupSummaryDto {
  completedCount: number;
  totalKg: number;
  totalAmount: number;
}

/** The contract's NearbyRequest: area and distance only, never the address or phone. */
export interface NearbyRequestDto {
  id: string;
  area: string;
  distanceM: number;
  categoryCodes: string[];
  weightBand: WeightBand;
  slotDate: string;
  slot: TimeSlot;
  hasPhoto: boolean;
  estimate: PayoutEstimateDto | null;
  requestedAt: string;
  expiresAt: string;
}
