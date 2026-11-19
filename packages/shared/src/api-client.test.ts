import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './api-client.js';

type Tokens = { accessToken: string; refreshToken: string };

function json(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)), json: async () => body } as Response;
}

function setup(responses: ((url: string, init: RequestInit) => Response)[]) {
  let tokens: Tokens | null = { accessToken: 'old', refreshToken: 'r1' };
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error('unexpected call');
    return next(url, init);
  });
  const onSignedOut = vi.fn(() => {
    tokens = null;
  });
  const client = createApiClient({
    baseUrl: 'http://api/api/v1',
    getAccessToken: () => tokens?.accessToken ?? null,
    getRefreshToken: () => tokens?.refreshToken ?? null,
    onSession: (s) => {
      tokens = { accessToken: s.accessToken!, refreshToken: s.refreshToken! };
    },
    onSignedOut,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { client, calls, onSignedOut, tokens: () => tokens };
}

const header = (init: RequestInit, name: string) => (init.headers as Record<string, string>)[name];

describe('api client', () => {
  it('sends the bearer token, query and Idempotency-Key', async () => {
    const { client, calls } = setup([() => json(200, { ok: true })]);
    await client.request('POST', '/pickups', { body: { a: 1 }, idempotencyKey: 'k1', query: { limit: 3, cursor: undefined } });
    expect(calls[0].url).toBe('http://api/api/v1/pickups?limit=3');
    expect(header(calls[0].init, 'Authorization')).toBe('Bearer old');
    expect(header(calls[0].init, 'Idempotency-Key')).toBe('k1');
    expect(calls[0].init.body).toBe('{"a":1}');
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const { client, calls, tokens } = setup([
      () => json(401, { code: 'UNAUTHORIZED', message: 'expired' }),
      () => json(200, { accessToken: 'new', refreshToken: 'r2', user: {} }),
      () => json(200, { id: 'p1' }),
    ]);
    await expect(client.request('GET', '/pickups/p1')).resolves.toEqual({ id: 'p1' });
    expect(calls[1].url).toBe('http://api/api/v1/auth/refresh');
    expect(header(calls[2].init, 'Authorization')).toBe('Bearer new');
    expect(tokens()).toEqual({ accessToken: 'new', refreshToken: 'r2' });
  });

  it('shares one refresh between concurrent 401s (refresh tokens work once)', async () => {
    const { client, calls } = setup([
      () => json(401, { code: 'UNAUTHORIZED', message: '' }),
      () => json(401, { code: 'UNAUTHORIZED', message: '' }),
      () => json(200, { accessToken: 'new', refreshToken: 'r2', user: {} }),
      () => json(200, 'a'),
      () => json(200, 'b'),
    ]);
    await Promise.all([client.request('GET', '/a'), client.request('GET', '/b')]);
    expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('signs out when the refresh token is refused', async () => {
    const { client, onSignedOut } = setup([
      () => json(401, { code: 'UNAUTHORIZED', message: '' }),
      () => json(401, { code: 'UNAUTHORIZED', message: '' }),
    ]);
    await expect(client.request('GET', '/me')).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    expect(onSignedOut).toHaveBeenCalled();
  });

  it('does not refresh for sign-in calls', async () => {
    const { client, calls } = setup([() => json(401, { code: 'OTP_INVALID', message: 'wrong', details: { attemptsLeft: 2 } })]);
    const err = await client.request('POST', '/auth/otp/verify', { auth: false }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'OTP_INVALID', details: { attemptsLeft: 2 } });
    expect(calls).toHaveLength(1);
    expect(header(calls[0].init, 'Authorization')).toBeUndefined();
  });

  it('maps a failed connection to NETWORK and 204 to undefined', async () => {
    const { client } = setup([
      () => {
        throw new TypeError('Network request failed');
      },
      () => json(204),
    ]);
    await expect(client.request('GET', '/x')).rejects.toMatchObject({ code: 'NETWORK', status: 0 });
    await expect(client.request('DELETE', '/x')).resolves.toBeUndefined();
  });
});
