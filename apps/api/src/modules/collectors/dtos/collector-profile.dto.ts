import type { VehicleType, VerificationStatus, WorkArea } from '@bw/shared';

/** The contract's CollectorProfile. */
export interface CollectorProfileDto {
  userId: string;
  name: string | null;
  phone: string;
  nidNumberMasked: string;
  nidVerified: boolean;
  selfieUrl: string | null;
  workAreas: WorkArea[];
  vehicleType: VehicleType;
  hasScale: boolean;
  verificationStatus: VerificationStatus;
  verificationNote: string | null;
  submittedAt: string;
  decidedAt: string | null;
  isOnline: boolean;
  ratingAvg: number | null;
  pickups30d: number;
  releases30d: number;
}

/** The contract's CollectorProfilePage. */
export interface CollectorProfilePageDto {
  items: CollectorProfileDto[];
  nextCursor: string | null;
}
