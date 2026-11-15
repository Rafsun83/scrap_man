import type { DisputeOutcome, DisputeStatus, DisputeType } from '@bw/shared';

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
