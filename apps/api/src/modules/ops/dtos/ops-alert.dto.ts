export type OpsAlertKind = 'ACCEPTED_PAST_SLOT' | 'CONFIRMED_UNPAID' | 'REVIEW_OVERDUE' | 'OTP_FAILURES' | 'PAYMENT_REPORTED' | 'NO_SHOW';

/** The contract's OpsAlert. */
export interface OpsAlertDto {
  id: string;
  kind: OpsAlertKind;
  severity: 'CRITICAL' | 'WARNING';
  pickupId: string | null;
  displayNo: string | null;
  userId: string | null;
  name: string | null;
  since: string;
  count: number | null;
}
