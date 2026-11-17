import { describe, expect, it, vi } from 'vitest'
import { ApiError, createApiClient } from './client'

const json = (status: number, body?: unknown) =>
  ({ ok: status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)), json: async () => body }) as Response

describe('admin API client', () => {
  it('refreshes once for concurrent 401s, then retries with the new token', async () => {
    let access = 'old'
    const onSession = vi.fn((s: { accessToken?: string }) => (access = s.accessToken!))
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/auth/refresh')) return json(200, { accessToken: 'new', refreshToken: 'r2', user: { role: 'ADMIN' } })
      const auth = ((init?.headers ?? {}) as Record<string, string>).Authorization
      return auth === 'Bearer new' ? json(200, { ok: true }) : json(401, { code: 'UNAUTHORIZED', message: 'expired' })
    })
    const api = createApiClient({ baseUrl: '/api/v1', getAccessToken: () => access, getRefreshToken: () => 'r1', onSession, onSignedOut: vi.fn(), fetchImpl })
    const results = await Promise.all([api.request('GET', '/admin/overview'), api.request('GET', '/admin/map')])
    expect(results).toEqual([{ ok: true }, { ok: true }])
    expect(fetchImpl.mock.calls.filter(([u]) => String(u).endsWith('/auth/refresh'))).toHaveLength(1)
  })

  it('turns API errors and lost connections into ApiError', async () => {
    const api = createApiClient({
      baseUrl: '',
      getAccessToken: () => 't',
      getRefreshToken: () => null,
      onSession: vi.fn(),
      onSignedOut: vi.fn(),
      fetchImpl: vi.fn(async () => json(409, { code: 'INVALID_STATE', message: 'Already decided', details: { x: 1 } })),
    })
    await expect(api.request('POST', '/x')).rejects.toMatchObject({ code: 'INVALID_STATE', status: 409, details: { x: 1 } })
    const offline = createApiClient({
      baseUrl: '',
      getAccessToken: () => 't',
      getRefreshToken: () => null,
      onSession: vi.fn(),
      onSignedOut: vi.fn(),
      fetchImpl: vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    })
    await expect(offline.request('GET', '/x')).rejects.toBeInstanceOf(ApiError)
  })
})
