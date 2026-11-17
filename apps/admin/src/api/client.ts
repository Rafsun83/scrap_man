import type { components } from '@bw/shared'

type ErrorCode = components['schemas']['Error']['code']
type Session = components['schemas']['Session']

/** Errors from the API ({ code, message, details }) plus NETWORK when the server can't be reached. */
export class ApiError extends Error {
  readonly code: ErrorCode | 'NETWORK' | 'UNKNOWN'
  readonly status: number
  readonly details: Record<string, unknown>
  constructor(code: ErrorCode | 'NETWORK' | 'UNKNOWN', message: string, status: number, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type RequestOptions = {
  query?: Record<string, string | number | undefined | null>
  body?: unknown
  idempotencyKey?: string
  /** False for sign-in calls: no bearer token and no refresh on 401. */
  auth?: boolean
}
export type ApiClient = {
  request<T>(method: Method, path: string, opts?: RequestOptions): Promise<T>
  /** Gets a new access token; shared by concurrent callers because refresh tokens work once. */
  refresh(): Promise<boolean>
}

export type ClientDeps = {
  baseUrl: string
  getAccessToken: () => string | null
  getRefreshToken: () => string | null
  onSession: (session: Session) => void
  onSignedOut: () => void
  fetchImpl?: typeof fetch
}

export function createApiClient(deps: ClientDeps): ApiClient {
  const doFetch = deps.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))
  let refreshing: Promise<boolean> | null = null

  function refresh(): Promise<boolean> {
    refreshing ??= (async () => {
      const refreshToken = deps.getRefreshToken()
      if (!refreshToken) return false
      try {
        const res = await doFetch(`${deps.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
        if (!res.ok) {
          if (res.status === 401) deps.onSignedOut()
          return false
        }
        deps.onSession((await res.json()) as Session)
        return true
      } catch {
        return false
      }
    })().finally(() => {
      refreshing = null
    })
    return refreshing
  }

  async function send(method: Method, path: string, opts: RequestOptions): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey
    const token = opts.auth === false ? null : deps.getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
    const qs = Object.entries(opts.query ?? {})
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
    try {
      return await doFetch(`${deps.baseUrl}${path}${qs ? `?${qs}` : ''}`, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      })
    } catch {
      throw new ApiError('NETWORK', 'The server could not be reached.', 0)
    }
  }

  async function request<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
    let res = await send(method, path, opts)
    if (res.status === 401 && opts.auth !== false && deps.getRefreshToken()) {
      if (await refresh()) res = await send(method, path, opts)
    }
    if (res.status === 204) return undefined as T
    const text = await res.text()
    let data: unknown
    try {
      data = text ? JSON.parse(text) : undefined
    } catch {
      data = undefined
    }
    if (!res.ok) {
      const err = (data ?? {}) as { code?: ErrorCode; message?: string; details?: Record<string, unknown> }
      throw new ApiError(err.code ?? 'UNKNOWN', err.message ?? `Request failed (${res.status}).`, res.status, err.details ?? {})
    }
    return data as T
  }

  return { request, refresh }
}

/** Asks for an upload slot at `path`, then PUTs the file straight to storage. Returns the photo id. */
export async function uploadPhoto(api: ApiClient, path: string, body: Record<string, unknown>, file: File): Promise<string> {
  const contentType = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg'
  const slot = await api.request<{ photoId: string; uploadUrl: string }>('POST', path, { body: { ...body, contentType } })
  const res = await fetch(slot.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
  if (!res.ok) throw new ApiError('UNKNOWN', `Upload failed (${res.status}).`, res.status)
  return slot.photoId
}
