import type { VehicleType } from '../enums/vehicle-type.enum.js';
import type { VerificationStatus } from '../enums/verification-status.enum.js';

/** A collector profile joined with the account's name and phone. */
export interface CollectorProfileRow {
  user_id: string;
  name: string | null;
  phone: string;
  nid_number: string;
  nid_verified: boolean;
  selfie_id: string | null;
  work_areas: string[];
  vehicle_type: VehicleType;
  has_scale: boolean;
  verification_status: VerificationStatus;
  verification_note: string | null;
  submitted_at: Date;
  decided_at: Date | null;
  is_online: boolean;
  rating_avg: string | null;
}

/** What a collector sends to apply (or apply again after a rejection). */
export interface CollectorApplication {
  userId: string;
  nidNumber: string;
  selfieId: string;
  workAreas: string[];
  vehicleType: VehicleType;
  hasScale: boolean;
}

/** Work details a collector may change at any time. */
export interface CollectorWorkChanges {
  workAreas?: string[];
  vehicleType?: VehicleType;
  hasScale?: boolean;
}
