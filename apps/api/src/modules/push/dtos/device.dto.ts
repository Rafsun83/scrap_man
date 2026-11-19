import { z } from 'zod';
import { DEVICE_PLATFORMS } from '@bw/shared';

/** Body of PUT /me/devices. */
export const deviceDto = z.object({ token: z.string().trim().min(1).max(4096), platform: z.enum(DEVICE_PLATFORMS) });

export type DeviceDto = z.infer<typeof deviceDto>;

/** Path of DELETE /me/devices/{token}. */
export const deviceTokenDto = z.object({ token: z.string().min(1).max(4096) });

export type DeviceTokenDto = z.infer<typeof deviceTokenDto>;
