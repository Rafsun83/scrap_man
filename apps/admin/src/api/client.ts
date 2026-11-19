import { ApiError, type ApiClient } from '@bw/shared'

/** The API client lives in @bw/shared (shared with the mobile app). */
export { ApiError, createApiClient, type ApiClient, type ApiMethod as Method, type RequestOptions } from '@bw/shared'

/** Asks for an upload slot at `path`, then PUTs the file straight to storage. Returns the photo id. */
export async function uploadPhoto(api: ApiClient, path: string, body: Record<string, unknown>, file: File): Promise<string> {
  const contentType = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg'
  const slot = await api.request<{ photoId: string; uploadUrl: string }>('POST', path, { body: { ...body, contentType } })
  const res = await fetch(slot.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
  if (!res.ok) throw new ApiError('UNKNOWN', `Upload failed (${res.status}).`, res.status)
  return slot.photoId
}
