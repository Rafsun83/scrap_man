/** The API client lives in @bw/shared (shared with the admin panel). */
export { ApiError, createApiClient, type ApiClient, type RequestOptions } from '@bw/shared';

export type Tokens = { accessToken: string; refreshToken: string };
