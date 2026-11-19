import type { components } from './generated/api.js';

type ErrorCode = components['schemas']['Error']['code'];
type Session = components['schemas']['Session'];

/** Errors from the API ({ code, message, details }), plus NETWORK when the server can't be reached. */
export class ApiError extends Error {
  readonly code: ErrorCode | 'NETWORK' | 'UNKNOWN';
  readonly status: number;
  readonly details: Record<string, unknown>;
  constructor(code: ErrorCode | 'NETWORK' | 'UNKNOWN', message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestOptions = {
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
  /** Sends Idempotency-Key; the API requires it on create, confirm and other money or status calls. */
  idempotencyKey?: string;
  /** False for sign-in calls: no bearer token and no refresh on 401. */
  auth?: boolean;
};

export type ApiClient = {
  request<T>(method: ApiMethod, path: string, opts?: RequestOptions): Promise<T>;
  /** Gets a new access token now; shared by concurrent callers because refresh tokens work once. */
  refresh(): Promise<boolean>;
};

export type ClientDeps = {
  /** e.g. "https://api.example/api/v1" or "/api/v1". */
  baseUrl: string;
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  /** A new token pair after a refresh. */
  onSession: (session: Session) => void;
  /** The refresh token no longer works: the person must sign in again. */
  onSignedOut: () => void;
  fetchImpl?: typeof fetch;
};

/**
 * The API client used by the mobile app and the admin panel: bearer token, one shared refresh on 401 (refresh
 * tokens rotate), sign-out when the refresh is refused, and `ApiError` for every failure.
 */
export function createApiClient(deps: ClientDeps): ApiClient {
  const doFetch = deps.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  let refreshing: Promise<boolean> | null = null;

  function refresh(): Promise<boolean> {
    refreshing ??= (async () => {
      const refreshToken = deps.getRefreshToken();
      if (!refreshToken) return false;
      try {
        const res = await doFetch(`${deps.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          // A 401 means the refresh token is spent or revoked; anything else is a passing failure.
          if (res.status === 401) deps.onSignedOut();
          return false;
        }
        deps.onSession((await res.json()) as Session);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function send(method: ApiMethod, path: string, opts: RequestOptions): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
    const token = opts.auth === false ? null : deps.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const qs = Object.entries(opts.query ?? {})
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
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

  async function request<T>(method: ApiMethod, path: string, opts: RequestOptions = {}): Promise<T> {
    let res = await send(method, path, opts);
    if (res.status === 401 && opts.auth !== false && deps.getRefreshToken()) {
      if (await refresh()) res = await send(method, path, opts);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let data: unknown;
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
