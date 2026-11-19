import type { DisputeOutcome, DisputeStatus, DisputeType, PaymentMethod } from '@bw/shared';
import type { NotificationTypeEnum } from '../enums/notification-type.enum.js';

/** The contract's Notification. */
export interface NotificationDto {
  id: string;
  type: NotificationTypeEnum;
  at: string;
  read: boolean;
  pickupId: string | null;
  displayNo: string | null;
  data: {
    categoryCodes?: string[];
    collectorName?: string | null;
    householdName?: string | null;
    amount?: number;
    totalKg?: number;
    method?: PaymentMethod;
    weighVersion?: number;
    disputeType?: DisputeType;
    disputeStatus?: DisputeStatus;
    outcome?: DisputeOutcome;
    effectiveDate?: string;
    note?: string | null;
    stars?: number;
  };
}

/** The contract's NotificationPage. */
export interface NotificationPageDto {
  items: NotificationDto[];
  nextCursor: string | null;
  unreadCount: number;
}
