import { describe, expect, it, vi } from 'vitest';
import type { BatchResponse } from 'firebase-admin/messaging';
import type { PushMessage } from '../types/push-sender.type.js';
import { FcmPushSender } from './fcm-push-sender.service.js';

const msg = (token: string, platform: PushMessage['platform'] = 'ANDROID'): PushMessage => ({
  token,
  platform,
  title: 'ভাঙ্গারিওয়ালা',
  body: 'সংগ্রাহক আসছেন',
  data: { kind: 'ACCEPTED', pickupId: 'p1' },
});

const ok = () => ({ success: true, messageId: 'm' });
const fail = (code: string) => ({ success: false, error: { code, message: code } });
const batch = (responses: object[]): BatchResponse =>
  ({
    responses,
    successCount: responses.filter((r) => (r as { success: boolean }).success).length,
    failureCount: responses.filter((r) => !(r as { success: boolean }).success).length,
  }) as BatchResponse;

describe('FcmPushSender', () => {
  it('sends a high-priority notification on the app channel with the data', async () => {
    const sendEach = vi.fn(async () => batch([ok()]));
    await new FcmPushSender({ sendEach }).send([msg('tok-1')]);
    expect(sendEach).toHaveBeenCalledWith([
      {
        token: 'tok-1',
        notification: { title: 'ভাঙ্গারিওয়ালা', body: 'সংগ্রাহক আসছেন' },
        data: { kind: 'ACCEPTED', pickupId: 'p1' },
        android: { priority: 'high', notification: { channelId: 'default', sound: 'default' } },
      },
    ]);
  });

  it('reports only dead tokens as invalid', async () => {
    const sendEach = vi.fn(async () =>
      batch([
        fail('messaging/registration-token-not-registered'),
        ok(),
        fail('messaging/invalid-registration-token'),
        fail('messaging/internal-error'),
      ]),
    );
    const res = await new FcmPushSender({ sendEach }).send([msg('dead-1'), msg('live'), msg('dead-2'), msg('flaky')]);
    expect(res.invalidTokens).toEqual(['dead-1', 'dead-2']);
  });

  it('skips iOS tokens without deleting them', async () => {
    const sendEach = vi.fn(async () => batch([ok()]));
    const res = await new FcmPushSender({ sendEach }).send([msg('apns', 'IOS'), msg('fcm')]);
    expect((sendEach.mock.calls[0] as unknown[])[0]).toHaveLength(1);
    expect(res.invalidTokens).toEqual([]);

    sendEach.mockClear();
    await new FcmPushSender({ sendEach }).send([msg('apns', 'IOS')]);
    expect(sendEach).not.toHaveBeenCalled();
  });

  it('splits into batches of 500 and carries on after a failed batch', async () => {
    const sendEach = vi
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockImplementationOnce(async (m: unknown[]) => batch(m.map(() => fail('messaging/registration-token-not-registered'))));
    const messages = Array.from({ length: 501 }, (_, i) => msg(`t${i}`));
    const res = await new FcmPushSender({ sendEach }).send(messages);
    expect(sendEach).toHaveBeenCalledTimes(2);
    expect((sendEach.mock.calls[0]![0] as unknown[]).length).toBe(500);
    expect(res.invalidTokens).toEqual(['t500']);
  });
});
