/** Private photo storage. Apps upload and download with short-lived presigned links. */
export interface PhotoStorage {
  /** A link the app sends the file to with HTTP PUT and the same Content-Type. */
  uploadUrl(key: string, contentType: string, expiresInSec: number): Promise<string>;
  /** A link to view the file. */
  downloadUrl(key: string, expiresInSec: number): Promise<string>;
  /** Whether the file has been uploaded. */
  exists(key: string): Promise<boolean>;
}
