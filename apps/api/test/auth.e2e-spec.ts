import { bearer, createTestApp, resetData, signIn, type TestContext } from './helpers.js';

const PHONE = '+8801711111111';

describe('Sign-in with OTP (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => (ctx = await createTestApp()));
  afterAll(() => ctx.app.close());
  beforeEach(() => resetData(ctx));

  it('signs up a new household and returns tokens', async () => {
    const session = await signIn(ctx, PHONE, 'HOUSEHOLD');
    expect(session.user).toMatchObject({ phone: PHONE, role: 'HOUSEHOLD', language: 'BN', status: 'ACTIVE' });
    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();
  });

  it('keeps the role a number signed up with', async () => {
    await signIn(ctx, PHONE, 'COLLECTOR');
    const again = await signIn(ctx, PHONE, 'HOUSEHOLD');
    expect(again.user.role).toBe('COLLECTOR');
  });

  it('rejects a wrong code and discards the OTP after 5 wrong tries', async () => {
    await ctx.http().post('/api/v1/auth/otp/request').send({ phone: PHONE }).expect(204);
    const right = ctx.sms.codes.get(PHONE)!;
    const wrong = right === '000000' ? '111111' : '000000';

    const first = await ctx.http().post('/api/v1/auth/otp/verify').send({ phone: PHONE, code: wrong, role: 'HOUSEHOLD' });
    expect(first.status).toBe(401);
    expect(first.body).toMatchObject({ code: 'OTP_INVALID', details: { attemptsLeft: 4 } });

    for (let i = 0; i < 4; i++) {
      await ctx.http().post('/api/v1/auth/otp/verify').send({ phone: PHONE, code: wrong, role: 'HOUSEHOLD' });
    }
    const late = await ctx.http().post('/api/v1/auth/otp/verify').send({ phone: PHONE, code: right, role: 'HOUSEHOLD' });
    expect(late.status).toBe(401);
  });

  it('limits OTP requests to 3 per phone in 10 minutes', async () => {
    for (let i = 0; i < 3; i++) {
      await ctx.http().post('/api/v1/auth/otp/request').send({ phone: PHONE }).expect(204);
    }
    const res = await ctx.http().post('/api/v1/auth/otp/request').send({ phone: PHONE });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('OTP_RATE_LIMIT');
    expect(res.body.details.retryAfterSec).toBeGreaterThan(0);
  });

  it('explains which field is wrong', async () => {
    const res = await ctx.http().post('/api/v1/auth/otp/request').send({ phone: '01711111111' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR', details: { issues: [{ path: 'phone' }] } });
  });

  it('rotates refresh tokens so each one works once', async () => {
    const session = await signIn(ctx, PHONE);
    const next = await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken }).expect(200);
    expect(next.body.refreshToken).not.toBe(session.refreshToken);
    await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
    await ctx.http().get('/api/v1/me').set(bearer(next.body.accessToken)).expect(200);
  });

  it('ends the session on logout', async () => {
    const session = await signIn(ctx, PHONE);
    await ctx.http().post('/api/v1/auth/logout').send({ refreshToken: session.refreshToken }).expect(204);
    await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
  });

  it('blocks a suspended account', async () => {
    const session = await signIn(ctx, PHONE);
    await ctx.db.query(`UPDATE users SET status = 'SUSPENDED' WHERE phone = $1`, [PHONE]);
    const res = await ctx.http().get('/api/v1/me').set(bearer(session.accessToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('asks for a token on private routes', async () => {
    const res = await ctx.http().get('/api/v1/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('keeps the health check public', async () => {
    const res = await ctx.http().get('/api/v1/health').expect(200);
    expect(res.body.checks).toEqual({ database: 'up', redis: 'up' });
  });
});
