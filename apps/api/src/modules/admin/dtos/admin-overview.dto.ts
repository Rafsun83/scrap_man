/** The contract's AttentionItem. */
export interface AttentionItemDto {
  kind: 'WAITING_TOO_LONG' | 'CODE_LOCKED' | 'DISPUTE_REVIEW' | 'RELEASES' | 'NO_SHOW';
  pickupId: string | null;
  displayNo: string | null;
  area: string | null;
  userId: string | null;
  name: string | null;
  since: string;
  count: number | null;
}

/** The contract's AdminOverview (A1). */
export interface AdminOverviewDto {
  counts: {
    requested: number;
    accepted: number;
    weighing: number;
    disputed: number;
    confirmed: number;
    completedToday: number;
    pendingApplications: number;
    openDisputes: number;
  };
  attention: AttentionItemDto[];
}

/** The contract's AdminMap (A1). */
export interface AdminMapDto {
  requests: { pickupId: string; displayNo: string; area: string; lat: number; lng: number; requestedAt: string; overdue: boolean }[];
  collectors: { userId: string; name: string | null; lat: number; lng: number; lastSeenAt: string; busy: boolean }[];
}
