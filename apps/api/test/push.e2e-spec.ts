import { bearer, createTestApp, resetData, type TestContext } from './helpers.js';
import { accept, arrive, confirm, createPickup, makeAdminSession, makeCollector, makeHousehold, north, pay, publishRates, weigh, type Session } from './pickup-helpers.js';

describe('Push devices and pushes (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => (ctx = await createTestApp()));
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await resetData(ctx);
    await publishRates(ctx);
  });

  const register = (s: Session, token: string, platform = 'ANDROID') =>
    ctx.http().put('/api/v1/me/devices').set(bearer(s.token)).send({ token, platform });
  const to = (token: string) => ctx.push.sent.filter((m) => m.token === token);

  it('pushes news to the other side only, in their language, with what to open', async () => {
    const household = await makeHousehold(ctx);
    const collector = await makeCollector(ctx, { at: north(100) });
    await register(household, 'hh-phone').expect(204);
    await register(collector, 'col-phone').expect(204);
    await ctx.http().patch('/api/v1/me').set(bearer(collector.token)).send({ language: 'EN' }).expect(200);

    const p = await createPickup(ctx, household);
    await ctx.push.settle();
    // The new request reaches the nearby collector, in English.
    expect(to('col-phone')).toEqual([
      expect.objectContaining({ title: 'BhangariWala', body: 'New request nearby: Mirpur 10. First to accept gets it.', data: { kind: 'NEW_REQUEST', event: 'request.created', pickupId: p.id } }),
    ]);

    await accept(ctx, collector, p.id).expect(200);
    await ctx.push.settle();
    // The household hears in Bangla; the collector is not told about their own accept.
    const hh = to('hh-phone');
    expect(hh).toHaveLength(1);
    expect(hh[0].body).toBe(`Sohel Rana আপনার অনুরোধ গ্রহণ করেছেন (${String(p.displayNo).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)])})। এলে পিকআপ কোডটি বলবেন।`);
    expect(hh[0].data).toMatchObject({ kind: 'ACCEPTED', event: 'pickup.accepted', pickupId: p.id });
    expect(to('col-phone')).toHaveLength(1);

    // The household cancels: only the collector is told.
    await ctx.http().post(`/api/v1/pickups/${p.id}/cancel`).set(bearer(household.token)).send({}).expect(200);
    await ctx.push.settle();
    expect(to('hh-phone')).toHaveLength(1);
    expect(to('col-phone').at(-1)).toMatchObject({ data: { kind: 'CANCELLED' } });
  });

  it('a whole sale pushes weighed and paid to the household and confirmed to the collector', async () => {
    const household = await makeHousehold(ctx);
    const collector = await makeCollector(ctx, { at: north(100) });
    await register(household, 'hh');
    await register(collector, 'col');
    const p = await createPickup(ctx, household);
    await accept(ctx, collector, p.id).expect(200);
    await arrive(ctx, household, collector, p.id);
    expect((await weigh(ctx, collector, p.id)).status).toBe(200);
    await confirm(ctx, household, p.id).expect(200);
    await pay(ctx, collector, p.id).expect(200);
    await ctx.push.settle();
    expect(to('hh').map((m) => m.data.kind)).toEqual(['ACCEPTED', 'WEIGHED', 'PAID']);
    expect(to('col').map((m) => m.data.kind)).toEqual(['NEW_REQUEST', 'CONFIRMED']);
  });

  it('moves a token to the new user, removes rejected tokens, and unregisters', async () => {
    const a = await makeHousehold(ctx);
    const b = await makeHousehold(ctx);
    await register(a, 'shared-phone').expect(204);
    await register(b, 'shared-phone', 'IOS').expect(204);
    const [row] = await ctx.db.query(`SELECT user_id, platform FROM push_devices WHERE token = 'shared-phone'`);
    expect(row).toEqual({ user_id: b.id, platform: 'IOS' });

    // A rejected token is deleted after the provider says so.
    const collector = await makeCollector(ctx, { at: north(100) });
    await register(collector, 'dead-token').expect(204);
    ctx.push.invalid.add('dead-token');
    await createPickup(ctx, b);
    await ctx.push.settle();
    expect(await ctx.db.query(`SELECT 1 FROM push_devices WHERE token = 'dead-token'`)).toEqual([]);

    // Unregistering someone else's token does nothing; your own removes it.
    await ctx.http().delete('/api/v1/me/devices/shared-phone').set(bearer(a.token)).expect(204);
    expect(await ctx.db.query(`SELECT 1 FROM push_devices WHERE token = 'shared-phone'`)).toHaveLength(1);
    await ctx.http().delete('/api/v1/me/devices/shared-phone').set(bearer(b.token)).expect(204);
    expect(await ctx.db.query(`SELECT 1 FROM push_devices WHERE token = 'shared-phone'`)).toEqual([]);
  });

  it('validates the body and keeps admins out', async () => {
    const h = await makeHousehold(ctx);
    await register(h, '', 'ANDROID').expect(400);
    await register(h, 'x', 'WINDOWS').expect(400);
    const admin = await makeAdminSession(ctx);
    await register(admin, 'admin-phone').expect(403);
  });

  it('tells a collector about the decision on their application', async () => {
    const pending = await makeCollector(ctx, { status: 'PENDING', online: false });
    await register(pending, 'applicant').expect(204);
    const admin = await makeAdminSession(ctx);
    await ctx.http().post(`/api/v1/admin/collectors/${pending.id}/decision`).set(bearer(admin.token)).send({ decision: 'APPROVED' }).expect(204);
    await ctx.push.settle();
    expect(to('applicant')).toEqual([expect.objectContaining({ data: { kind: 'APPROVED', event: 'collector.verification' } })]);
  });
});
