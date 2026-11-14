/** Private photo storage. Apps upload and download with short-lived presigned links. */
export interface PhotoStorage {
  /** A link the app sends the file to with HTTP PUT and the same Content-Type. */
  uploadUrl(key: string, contentType: string, expiresInSec: number): Promise<string>;
  /** A link to view the file. */
  downloadUrl(key: string, expiresInSec: number): Promise<string>;
  /** Whether the file has been uploaded. */
  exists(key: string): Promise<boolean>;
}

export const PHOTO_STORAGE = Symbol('PHOTO_STORAGE');

export const UPLOAD_URL_TTL_SEC = 10 * 60;
export const DOWNLOAD_URL_TTL_SEC = 15 * 60;
