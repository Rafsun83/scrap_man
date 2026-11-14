import type { ErrorCode, Session } from './types';

/** Errors from the API ({ code, message, details }) plus NETWORK when the server can't be reached. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK' | 'UNKNOWN',
    message: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type Tokens = { accessToken: string; refreshToken: string };

export type ClientDeps = {
  baseUrl: string;
  getTokens: () => Tokens | null;
  /** Called with a new token pair after a refresh. */
  onTokens: (session: Session) => void;
  /** Called when the refresh token no longer works: the person must sign in again. */
  onSignedOut: () => void;
  fetchImpl?: typeof fetch;
};

export type RequestOptions = {
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /** Sends Idempotency-Key; required by the API on create, confirm and other money or status calls. */
  idempotencyKey?: string;
  /** False for sign-in calls: no bearer token and no refresh on 401. */
  auth?: boolean;
};

export type ApiClient = {
  request<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, opts?: RequestOptions): Promise<T>;
  /** Refreshes the access token now; shared by concurrent callers because refresh tokens work once. */
  refresh(): Promise<boolean>;
};

export function createApiClient(deps: ClientDeps): ApiClient {
  const doFetch = deps.fetchImpl ?? fetch;
  let refreshing: Promise<boolean> | null = null;

  function refresh(): Promise<boolean> {
    refreshing ??= (async () => {
      const tokens = deps.getTokens();
      if (!tokens) return false;
      try {
        const res = await doFetch(`${deps.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });
        if (!res.ok) {
          // A 401 means the refresh token is spent or revoked; anything else is a passing failure.
          if (res.status === 401) deps.onSignedOut();
          return false;
        }
        deps.onTokens((await res.json()) as Session);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function send(method: string, path: string, opts: RequestOptions): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
    const tokens = opts.auth === false ? null : deps.getTokens();
    if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
    const qs = opts.query
      ? Object.entries(opts.query)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    try {
      return await doFetch(`${deps.baseUrl}${path}${qs ? `?${qs}` : ''}`, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
    } catch {
      throw new ApiError('NETWORK', 'The server could not be reached.', 0);
    }
  }

  async function request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    let res = await send(method, path, opts);
    if (res.status === 401 && opts.auth !== false && deps.getTokens()) {
      if (await refresh()) res = await send(method, path, opts);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let data: unknown = undefined;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = undefined;
    }
    if (!res.ok) {
      const err = (data ?? {}) as { code?: ErrorCode; message?: string; details?: Record<string, unknown> };
      throw new ApiError(err.code ?? 'UNKNOWN', err.message ?? `Request failed (${res.status}).`, res.status, err.details ?? {});
    }
    return data as T;
  }

  return { request, refresh };
}
