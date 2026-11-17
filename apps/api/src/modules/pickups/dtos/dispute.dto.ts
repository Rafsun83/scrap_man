import type { DisputeOutcome, DisputeStatus, DisputeType, PickupStatus } from '@bw/shared';

/** The contract's Dispute. */
export interface DisputeDto {
  id: string;
  pickupId: string;
  displayNo: string;
  type: DisputeType;
  status: DisputeStatus;
  raisedBy: string;
  reason: string | null;
  photoIds: string[];
  outcome: DisputeOutcome | null;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

/** The contract's AdminDispute: the dispute with the pickup's area, status and both names. */
export interface AdminDisputeDto extends DisputeDto {
  pickupStatus: PickupStatus;
  area: string;
  householdName: string | null;
  collectorName: string | null;
}
