import type { DisputeOutcome, DisputeStatus, DisputeType, PaymentMethod, PickupStatus, Role, TimeSlot, WeightBand } from '@bw/shared';
import type { PricingType } from '../../catalog/enums/pricing-type.enum.js';

/** A pickup row with the people around it, as loaded for views and events. */
export interface PickupRow {
  id: string;
  display_no: string;
  household_id: string;
  collector_id: string | null;
  address_text: string;
  area: string;
  lat: number;
  lng: number;
  slot_date: string;
  slot: TimeSlot;
  weight_band: WeightBand;
  note: string | null;
  status: PickupStatus;
  search_radius_m: number;
  code_attempts: number;
  payment_method: PaymentMethod | null;
  wallet_number: string | null;
  total_kg: string | null;
  total_amount: string | null;
  requested_at: Date;
  accepted_at: Date | null;
  arrived_at: Date | null;
  weighed_at: Date | null;
  confirmed_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  expires_at: Date;
  household_name: string | null;
  household_phone: string;
  collector_name: string | null;
  collector_phone: string | null;
  collector_rating: string | null;
  /** The collector's last ping (collector_profiles.last_location); null if never sent. */
  collector_lat: number | null;
  collector_lng: number | null;
  collector_seen_at: Date | null;
  rating_stars: number | null;
  rating_comment: string | null;
  rated_at: Date | null;
  /** The latest status change (requested_at before any). */
  updated_at: Date;
}

export interface ItemRow {
  pickup_id: string;
  category_id: string;
  code: string;
  pricing_type: PricingType;
  rate_snapshot: string | null;
  current_rate: string | null;
  sort_order: number;
}

export interface WeighLineRow {
  pickup_id: string;
  version: number;
  code: string;
  kg: string;
  rate: string | null;
  amount: string;
  created_by_role: Role;
  created_at: Date;
  sort_order: number;
}

export interface PhotoRow {
  id: string;
  pickup_id: string;
  kind: 'ITEMS' | 'SCALE';
  weigh_version: number | null;
  storage_key: string;
  uploaded_by: string;
  created_at: Date;
}

export interface PaymentRow {
  pickup_id: string;
  method: PaymentMethod;
  amount: string;
  wallet_number: string | null;
  trx_id: string | null;
  status: 'PAID' | 'REPORTED' | 'VERIFIED';
  paid_at: Date;
}

export interface DisputeRow {
  id: string;
  pickup_id: string;
  display_no: string;
  raised_by: string;
  type: DisputeType;
  status: DisputeStatus;
  reason: string | null;
  photo_ids: string[];
  resolution: DisputeOutcome | null;
  resolution_note: string | null;
  created_at: Date;
  resolved_at: Date | null;
}

export interface PickupRecord {
  row: PickupRow;
  items: ItemRow[];
  weighLines: WeighLineRow[];
  photos: PhotoRow[];
  payment: PaymentRow | null;
  disputes: DisputeRow[];
}

/** Who is looking at a pickup. */
export interface Viewer {
  id: string;
  role: Role;
}

/** Who moves a pickup: a signed-in role, or the system (matching jobs). */
export type Actor = Role | 'SYSTEM';

/** Who made a change, as written to status_events. */
export interface ActorRef {
  id: string | null;
  role: Actor;
}

/** The columns a write path needs, read with a row lock. */
export interface LockedPickup {
  id: string;
  display_no: string;
  status: PickupStatus;
  household_id: string;
  collector_id: string | null;
  pickup_code_hash: string | null;
  code_attempts: number;
  payment_method: PaymentMethod | null;
  wallet_number: string | null;
  total_amount: string | null;
  search_radius_m: number;
  expires_at: Date;
}

/** Enough of a pickup to address its live events. */
export interface PickupRef {
  id: string;
  display_no: string;
  household_id: string;
  collector_id: string | null;
}

/** One status_events row with the actor's name, for the admin timeline. */
export interface PickupEventRow {
  id: string;
  at: Date;
  from_status: PickupStatus | null;
  to_status: PickupStatus;
  actor_role: Role | null;
  actor_name: string | null;
  meta: Record<string, unknown> | null;
}

/** A dispute with the pickup's area, status and both names (admin list). */
export interface AdminDisputeRow extends DisputeRow {
  pickup_status: PickupStatus;
  area: string;
  household_name: string | null;
  collector_name: string | null;
}
