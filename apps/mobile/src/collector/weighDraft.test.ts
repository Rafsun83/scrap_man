import { ApiError, type ApiClient } from '../api/client';
import { PhotoUploadError, sendDraft, type WeighDraft } from './weighDraft';

jest.mock('expo-crypto', () => ({ randomUUID: () => `key-${Math.random()}` }));
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(async () => {}), getItemAsync: jest.fn(async () => null), deleteItemAsync: jest.fn(async () => {}) }));

const lines = [{ categoryCode: 'IRON', kg: 9.5 }];
const draft = (over: Partial<WeighDraft> = {}): WeighDraft => ({
  pickupId: 'p1',
  round: 1,
  lines: [{ categoryCode: 'IRON', kg: 9.5, quoted: '' }],
  photo: { uri: 'file:///scale.jpg', mimeType: 'image/jpeg' },
  photoId: null,
  key: 'key-1',
  queued: false,
  ...over,
});

function fakeApi(weights: () => Promise<unknown>) {
  const calls: { method: string; path: string; opts?: { body?: unknown; idempotencyKey?: string } }[] = [];
  const api: ApiClient = {
    refresh: async () => true,
    request: (async (method: string, path: string, opts?: { body?: unknown; idempotencyKey?: string }) => {
      calls.push({ method, path, opts });
      if (path.endsWith('/photos')) return { photoId: 'photo-1', uploadUrl: 'https://s3/upload', expiresAt: '' };
      return weights();
    }) as ApiClient['request'],
  };
  return { api, calls };
}

beforeEach(() => {
  globalThis.fetch = jest.fn(async (url: string) =>
    url.startsWith('file:') ? ({ blob: async () => 'blob' } as never) : ({ ok: true, status: 200 } as never),
  ) as never;
});

describe('weigh draft sending', () => {
  it('uploads the scale photo, then sends the round with its key', async () => {
    const { api, calls } = fakeApi(async () => ({ id: 'p1', status: 'WEIGHED' }));
    const out = await sendDraft(api, draft(), lines, () => {});
    expect(out.kind).toBe('SENT');
    expect(calls.map((c) => c.path)).toEqual(['/pickups/p1/photos', '/pickups/p1/weights']);
    expect(calls[0].opts?.body).toEqual({ kind: 'SCALE', contentType: 'image/jpeg' });
    expect(calls[1].opts).toEqual({ body: { lines, scalePhotoId: 'photo-1' }, idempotencyKey: 'key-1' });
  });

  it('queues an offline send and retries with the same key without uploading again', async () => {
    const saved: WeighDraft[] = [];
    const offline = fakeApi(async () => {
      throw new ApiError('NETWORK', 'offline', 0);
    });
    const first = await sendDraft(offline.api, draft(), lines, (d) => saved.push(d));
    expect(first.kind).toBe('QUEUED');
    if (first.kind !== 'QUEUED') return;
    expect(first.draft).toMatchObject({ queued: true, photoId: 'photo-1', key: 'key-1' });
    expect(saved.at(-1)).toMatchObject({ queued: true, photoId: 'photo-1' });

    const online = fakeApi(async () => ({ id: 'p1', status: 'WEIGHED' }));
    const retry = await sendDraft(online.api, first.draft, lines, () => {});
    expect(retry.kind).toBe('SENT');
    expect(online.calls.map((c) => c.path)).toEqual(['/pickups/p1/weights']);
    expect(online.calls[0].opts?.idempotencyKey).toBe('key-1');
  });

  it('sends the weights without a photo when none was taken', async () => {
    const { api, calls } = fakeApi(async () => ({ id: 'p1', status: 'WEIGHED' }));
    const out = await sendDraft(api, draft({ photo: null }), lines, () => {});
    expect(out.kind).toBe('SENT');
    expect(calls.map((c) => c.path)).toEqual(['/pickups/p1/weights']);
    expect(calls[0].opts).toEqual({ body: { lines }, idempotencyKey: 'key-1' });
  });

  it('queues without a photo when the API cannot be reached', async () => {
    const { api } = fakeApi(async () => {
      throw new ApiError('NETWORK', 'offline', 0);
    });
    const out = await sendDraft(api, draft({ photo: null }), lines, () => {});
    expect(out.kind).toBe('QUEUED');
  });

  it('does not call it "no internet" when the API answered but storage did not', async () => {
    // The phone reached the API (upload slot given) but not the storage link, e.g. S3_ENDPOINT=localhost.
    globalThis.fetch = jest.fn(async (url: string) => {
      if (url.startsWith('file:')) return { blob: async () => 'blob' } as never;
      throw new TypeError('Network request failed');
    }) as never;
    const { api, calls } = fakeApi(async () => ({}));
    const out = await sendDraft(api, draft(), lines, () => {});
    expect(out.kind).toBe('FAILED');
    if (out.kind !== 'FAILED') return;
    expect(out.error).toBeInstanceOf(PhotoUploadError);
    expect(out.draft).toMatchObject({ photo: null, photoId: null, queued: false });
    expect(out.draft.key).not.toBe('key-1');
    expect(calls.map((c) => c.path)).toEqual(['/pickups/p1/photos']);
  });

  it('still queues when the upload slot request itself finds no connection', async () => {
    const api: ApiClient = {
      refresh: async () => true,
      request: (async () => {
        throw new ApiError('NETWORK', 'offline', 0);
      }) as ApiClient['request'],
    };
    const out = await sendDraft(api, draft(), lines, () => {});
    expect(out.kind).toBe('QUEUED');
    if (out.kind !== 'QUEUED') return;
    expect(out.draft.photo).not.toBeNull();
  });

  it('asks for a new photo when the server refuses the scale photo', async () => {
    const { api } = fakeApi(async () => {
      throw new ApiError('SCALE_PHOTO_REQUIRED', 'Take a new photo', 422);
    });
    const out = await sendDraft(api, draft({ photoId: 'old' }), lines, () => {});
    expect(out.kind).toBe('FAILED');
    if (out.kind !== 'FAILED') return;
    expect(out.draft).toMatchObject({ photo: null, photoId: null, queued: false });
    expect(out.draft.key).not.toBe('key-1');
  });

  it('keeps the draft but stops retrying on other refusals', async () => {
    const { api } = fakeApi(async () => {
      throw new ApiError('INVALID_STATE', 'moved on', 409);
    });
    const out = await sendDraft(api, draft({ photoId: 'photo-1', queued: true }), lines, () => {});
    expect(out.kind).toBe('FAILED');
    if (out.kind !== 'FAILED') return;
    expect(out.draft).toMatchObject({ queued: false, photoId: 'photo-1', key: 'key-1' });
  });
});
