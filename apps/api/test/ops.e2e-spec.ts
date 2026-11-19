import { OpsAlertsService } from '../src/modules/ops/services/ops-alerts.service.js';
import { bearer, createTestApp, resetData, type TestContext } from './helpers.js';
import { createPickup, makeAdminSession, makeHousehold, nextPhone, pickupAt, publishRates, type Session } from './pickup-helpers.js';

describe('Ops alerts and request ids (e2e)', () => {
  let ctx: TestContext;
  let admin: Session;
  beforeAll(async () => (ctx = await createTestApp()));
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await resetData(ctx);
    await publishRates(ctx);
    admin = await makeAdminSession(ctx);
  });

  /** Many sign-ins from one test address would hit the per-IP OTP limit; clear only those counters. */
  const clearOtpLimits = async () => {
    const keys = await ctx.redis.keys('bw:otp:rl:*');
    if (keys.length) await ctx.redis.del(...keys);
  };

  const alerts = async () => (await ctx.http().get('/api/v1/admin/alerts').set(bearer(admin.token)).expect(200)).body as { id: string; kind: string; severity: string; pickupId: string | null; count: number | null; name: string | null }[];

  it('lists stuck pickups, payment reports and no-shows, most severe first', async () => {
    const pastSlot = await pickupAt(ctx, 'ACCEPTED');
    await ctx.db.query(`UPDATE pickups SET expires_at = now() - interval '61 minutes' WHERE id = $1`, [pastSlot.id]);
    const unpaid = await pickupAt(ctx, 'CONFIRMED');
    await ctx.db.query(`UPDATE pickups SET confirmed_at = now() - interval '121 minutes' WHERE id = $1`, [unpaid.id]);
    const reported = await pickupAt(ctx, 'COMPLETED');
    await ctx.http().post(`/api/v1/pickups/${reported.id}/dispute`).set(bearer(reported.household.token)).send({ type: 'PAYMENT' }).expect(201);
    await ctx.db.query(`UPDATE disputes SET created_at = now() - interval '25 hours' WHERE pickup_id = $1`, [reported.id]);
    await clearOtpLimits();
    // Not yet alerts: a fresh confirmation and an ACCEPTED pickup whose slot is still on.
    await pickupAt(ctx, 'CONFIRMED');
    await pickupAt(ctx, 'ACCEPTED');

    const list = await alerts();
    expect(list.map((a) => `${a.severity}:${a.kind}`)).toEqual(['CRITICAL:CONFIRMED_UNPAID', 'WARNING:REVIEW_OVERDUE', 'WARNING:ACCEPTED_PAST_SLOT']);
    expect(list[0]).toMatchObject({ id: `CONFIRMED_UNPAID:${unpaid.id}`, pickupId: unpaid.id, name: 'Sohel Rana' });

    await clearOtpLimits();
    // A fresh payment report is critical too.
    const fresh = await pickupAt(ctx, 'COMPLETED');
    await ctx.http().post(`/api/v1/pickups/${fresh.id}/dispute`).set(bearer(fresh.household.token)).send({ type: 'PAYMENT' }).expect(201);
    expect((await alerts()).filter((a) => a.kind === 'PAYMENT_REPORTED').map((a) => a.pickupId)).toEqual([fresh.id]);
  });

  it('raises OTP_FAILURES after more than 20 wrong codes in 10 minutes', async () => {
    for (let i = 0; i < 5; i++) {
      const phone = nextPhone();
      await ctx.http().post('/api/v1/auth/otp/request').send({ phone }).expect(204);
      for (let j = 0; j < 5; j++) await ctx.http().post('/api/v1/auth/otp/verify').send({ phone, code: '000000', role: 'HOUSEHOLD' });
    }
    const otp = (await alerts()).find((a) => a.kind === 'OTP_FAILURES');
    expect(otp).toMatchObject({ severity: 'CRITICAL', count: 25 });
  });

  it('announces each alert once (log and ops.alert), then stays quiet', async () => {
    const unpaid = await pickupAt(ctx, 'CONFIRMED');
    await ctx.db.query(`UPDATE pickups SET confirmed_at = now() - interval '3 hours' WHERE id = $1`, [unpaid.id]);
    const service = ctx.app.get(OpsAlertsService);
    expect((await service.check()).map((a) => a.id)).toEqual([`CONFIRMED_UNPAID:${unpaid.id}`]);
    expect(await service.check()).toEqual([]);
  });

  it('keeps alerts to admins', async () => {
    const h = await makeHousehold(ctx);
    await ctx.http().get('/api/v1/admin/alerts').set(bearer(h.token)).expect(403);
  });

  it('echoes a valid X-Request-Id or makes one', async () => {
    const own = await ctx.http().get('/api/v1/health').set('X-Request-Id', 'trace-abc_123');
    expect(own.headers['x-request-id']).toBe('trace-abc_123');
    const made = await ctx.http().get('/api/v1/health').set('X-Request-Id', 'bad id with spaces');
    expect(made.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const error = await ctx.http().get('/api/v1/me');
    expect(error.status).toBe(401);
    expect(error.headers['x-request-id']).toBeTruthy();
  });

  it('shows no-shows on the admin overview and per household', async () => {
    const household = await makeHousehold(ctx);
    const p = await createPickup(ctx, household);
    await ctx.db.query(`UPDATE pickups SET status = 'CANCELLED' WHERE id = $1`, [p.id]);
    await ctx.db.query(
      `INSERT INTO status_events (pickup_id, from_status, to_status, actor_role, meta, at) VALUES ($1, 'ACCEPTED', 'CANCELLED', 'COLLECTOR', '{"reason": "NO_SHOW"}', now())`,
      [p.id],
    );
    const overview = (await ctx.http().get('/api/v1/admin/overview').set(bearer(admin.token)).expect(200)).body;
    expect(overview.attention).toEqual([expect.objectContaining({ kind: 'NO_SHOW', pickupId: p.id, area: 'Mirpur 10' })]);
    const users = (await ctx.http().get('/api/v1/admin/users?role=HOUSEHOLD').set(bearer(admin.token)).expect(200)).body.items;
    expect(users.find((u: { id: string }) => u.id === household.id).household.noShows30d).toBe(1);
    expect((await alerts()).map((a) => a.kind)).toEqual(['NO_SHOW']);
  });
});
