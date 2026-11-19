import { describe, expect, it, vi } from 'vitest';
import { HttpSmsService, maskPhone } from './http-sms.service.js';

const res = (status: number) => ({ ok: status < 300, status }) as Response;

describe('HttpSmsService', () => {
  const settings = { url: 'https://sms.example/send', apiKey: 'key-1', senderId: 'BhangariWala', timeoutMs: 1000 };

  it('posts the message with the key and sender id', async () => {
    const fetchImpl = vi.fn(async () => res(200));
    await new HttpSmsService({ ...settings, fetchImpl }).send('+8801712345678', 'Code: 123456');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://sms.example/send');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer key-1' });
    expect(JSON.parse(init.body as string)).toEqual({ to: '+8801712345678', message: 'Code: 123456', senderId: 'BhangariWala' });
  });

  it('retries once after a network error or 5xx, then gives up', async () => {
    const flaky = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(res(200));
    await new HttpSmsService({ ...settings, fetchImpl: flaky }).send('+8801712345678', 'x');
    expect(flaky).toHaveBeenCalledTimes(2);

    const down = vi.fn(async () => res(503));
    await expect(new HttpSmsService({ ...settings, fetchImpl: down }).send('+8801712345678', 'x')).rejects.toThrow('+88017XXXXX678');
    expect(down).toHaveBeenCalledTimes(2);
  });

  it('does not retry a refusal', async () => {
    const refused = vi.fn(async () => res(400));
    await expect(new HttpSmsService({ ...settings, fetchImpl: refused }).send('+8801712345678', 'x')).rejects.toThrow('refused');
    expect(refused).toHaveBeenCalledTimes(1);
  });

  it('masks numbers in logs', () => {
    expect(maskPhone('+8801712345678')).toBe('+88017XXXXX678');
  });
});
