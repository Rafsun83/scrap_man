import type { components } from '@bw/shared';

type S = components['schemas'];

export type Pickup = S['Pickup'];
export type PickupPage = S['PickupPage'];
export type PickupLine = S['PickupLine'];
export type User = S['User'];
export type Session = S['Session'];
export type Category = S['Category'];
export type Rate = S['Rate'];
export type Address = S['Address'];
export type AddressInput = S['AddressInput'];
export type CreatePickup = S['CreatePickup'];
export type Dispute = S['Dispute'];
export type DisputeType = S['DisputeType'];
export type PaymentMethod = S['PaymentMethod'];
export type Photo = S['Photo'];
export type ErrorCode = S['Error']['code'];
export type MeSummary = S['MeSummary'];
export type Notification = S['Notification'];
export type NotificationPage = S['NotificationPage'];
export type NotificationType = S['NotificationType'];

export type TodayRates = {
  effectiveDate?: string;
  publishedAt?: string;
  rates?: Rate[];
};

export type UploadSlot = { photoId: string; uploadUrl: string; expiresAt: string };

export type PickupFilter = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
