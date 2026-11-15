import { z } from 'zod';

export const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];

/** Body of POST /pickups/{id}/photos. */
export const photoUploadDto = z.object({
  kind: z.enum(['ITEMS', 'SCALE']),
  contentType: z.enum(PHOTO_CONTENT_TYPES).default('image/jpeg'),
});

export type PhotoUploadDto = z.infer<typeof photoUploadDto>;

/** The contract's PhotoUploadSlot. */
export interface PhotoUploadSlotDto {
  photoId: string;
  uploadUrl: string;
  expiresAt: string;
}
