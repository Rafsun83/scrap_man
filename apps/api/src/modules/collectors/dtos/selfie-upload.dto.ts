import { z } from 'zod';

export const SELFIE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type SelfieContentType = (typeof SELFIE_CONTENT_TYPES)[number];

/** Body of POST /collector/selfie (may be empty). */
export const selfieUploadDto = z
  .object({ contentType: z.enum(SELFIE_CONTENT_TYPES).default('image/jpeg') })
  .default({ contentType: 'image/jpeg' });

export type SelfieUploadDto = z.infer<typeof selfieUploadDto>;

/** The contract's UploadSlot. */
export interface UploadSlotDto {
  photoId: string;
  uploadUrl: string;
  expiresAt: string;
}
