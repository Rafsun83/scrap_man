import { dhakaToday } from '../src/common/time.js';
import { bearer, createTestApp, resetData, type TestContext } from './helpers.js';
import {
  accept,
  createPickup,
  makeAdminSession,
  makeCollector,
  makeHousehold,
  north,
  pickupAt,
  publishRates,
  weigh,
} from './pickup-helpers.js';

type Item = { id: string; type: string; read: boolean; pickupId: string | null; displayNo: string | null; data: Record<string, unknown> };

describe('Notifications (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => (ctx = await createTestApp()));
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await resetData(ctx);
    await publishRates(ctx);
  });

  const feed = (token: string, query = '') => ctx.http().get(`/api/v1/me/notifications${query}`).set(bearer(token));
  const types = (items: Item[]) => items.map((i) => i.type);

  it('lists what others did on the household\'s pickup, newest first, with the details the app shows', async () => {
    const { household, id } = await pickupAt(ctx, 'COMPLETED');
    const res = await feed(household.token).expect(200);
    const items = res.body.items as Item[];

    // confirm was the household's own action, so it is not listed; rates were published before sign-up.
    expect(types(items)).toEqual(['PICKUP_PAID', 'PICKUP_WEIGHED', 'PICKUP_ACCEPTED']);
    expect(items.every((i) => i.pickupId === id && /^BW-\d+$/.test(i.displayNo!))).toBe(true);
    expect(items[0].data).toEqual({ categoryCodes: ['IRON', 'NEWSPAPER'], collectorName: 'Sohel Rana', method: 'CASH', amount: 625 });
    expect(items[1].data).toMatchObject({ weighVersion: 1, totalKg: 14.5, amount: 625, collectorName: 'Sohel Rana' });
    expect(items[2].data).toMatchObject({ collectorName: 'Sohel Rana' });
    expect(res.body).toMatchObject({ unreadCount: 3, nextCursor: null });
    expect(items.every((i) => i.read === false)).toBe(true);
  });

  it('marks everything read, and counts only what happens afterwards', async () => {
    const household = await makeHousehold(ctx);
    const collector = await makeCollector(ctx, { at: north(200) });
    const { id } = await createPickup(ctx, household);
    await accept(ctx, collector, id).expect(200);

    await ctx.http().post('/api/v1/me/notifications/read').set(bearer(household.token)).expect(204);
    let res = await feed(household.token).expect(200);
    expect(res.body.unreadCount).toBe(0);
    expect(res.body.items[0]).toMatchObject({ type: 'PICKUP_ACCEPTED', read: true });

    await new Promise((r) => setTimeout(r, 5));
    await ctx.http().post(`/api/v1/pickups/${id}/release`).set(bearer(collector.token)).send({}).expect(204);
    res = await feed(household.token).expect(200);
    expect(res.body.unreadCount).toBe(1);
    expect(res.body.items[0]).toMatchObject({ type: 'PICKUP_RELEASED', read: false, data: { collectorName: 'Sohel Rana' } });
  });

  it('lists re-weighs and resolved disputes, but not the household\'s own dispute or cancel', async () => {
    const { household, collector, id } = await pickupAt(ctx, 'WEIGHED');
    await ctx.http().post(`/api/v1/pickups/${id}/dispute`).set(bearer(household.token)).send({ type: 'WEIGHT' }).expect(201);
    expect((await weigh(ctx, collector, id, [{ categoryCode: 'IRON', kg: 10 }, { categoryCode: 'NEWSPAPER', kg: 5 }])).status).toBe(200);

    // Admin cancels after a behaviour report is resolved with no action.
    const admin = await makeAdminSession(ctx);
    const opened = await ctx.http().post(`/api/v1/pickups/${id}/dispute`).set(bearer(household.token)).send({ type: 'BEHAVIOUR' }).expect(201);
    await ctx.http().post(`/api/v1/admin/disputes/${opened.body.id}/resolve`).set(bearer(admin.token)).send({ outcome: 'NO_ACTION', note: 'Spoke to both.' }).expect(200);
    await ctx.http().post(`/api/v1/admin/pickups/${id}/cancel`).set(bearer(admin.token)).send({ reason: 'Household asked.' }).expect(200);

    const items = (await feed(household.token).expect(200)).body.items as Item[];
    expect(types(items)).toEqual(['PICKUP_CANCELLED', 'DISPUTE_RESOLVED', 'PICKUP_WEIGHED', 'PICKUP_WEIGHED', 'PICKUP_ACCEPTED']);
    expect(items[1].data).toMatchObject({ disputeType: 'BEHAVIOUR', outcome: 'NO_ACTION' });
    expect(items[2].data).toMatchObject({ weighVersion: 2, totalKg: 15, amount: 650 });
    expect(items[3].data).toMatchObject({ weighVersion: 1 });

    // A household cancelling its own request is not news to itself.
    const other = await makeHousehold(ctx);
    const own = await createPickup(ctx, other);
    await ctx.http().post(`/api/v1/pickups/${own.id}/cancel`).set(bearer(other.token)).send({}).expect(200);
    expect((await feed(other.token).expect(200)).body.items).toEqual([]);
  });

  it('announces rates published after the account was created, once per day', async () => {
    const household = await makeHousehold(ctx);
    expect((await feed(household.token).expect(200)).body.items).toEqual([]);

    const admin = await makeAdminSession(ctx);
    // Publishing twice (a correction) still gives one item. The first publish today predates sign-up,
    // so move it to now to stand for "published after".
    await ctx.db.query(`UPDATE daily_rates SET published_at = now() WHERE effective_date = $1`, [dhakaToday()]);
    await ctx.http().put('/api/v1/admin/rates').set(bearer(admin.token)).send({ effectiveDate: dhakaToday(), rates: [{ categoryCode: 'IRON', ratePerKg: 52 }] }).expect(204);

    const items = (await feed(household.token).expect(200)).body.items as Item[];
    expect(items).toEqual([
      expect.objectContaining({ id: `rp:${dhakaToday()}`, type: 'RATES_PUBLISHED', pickupId: null, displayNo: null, data: { effectiveDate: dhakaToday() } }),
    ]);
  });

  it('pages with a cursor', async () => {
    const { household } = await pickupAt(ctx, 'COMPLETED');
    const first = await feed(household.token, '?limit=2').expect(200);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.unreadCount).toBe(3);
    const second = await feed(household.token, `?limit=2&cursor=${first.body.nextCursor}`).expect(200);
    expect(types(second.body.items)).toEqual(['PICKUP_ACCEPTED']);
    expect(second.body.nextCursor).toBeNull();
    const bad = await feed(household.token, '?cursor=nonsense').expect(400);
    expect(bad.body.code).toBe('VALIDATION_ERROR');
  });

  it('shows each household only its own feed and refuses collectors', async () => {
    await pickupAt(ctx, 'COMPLETED');
    const stranger = await makeHousehold(ctx);
    expect((await feed(stranger.token).expect(200)).body).toEqual({ items: [], nextCursor: null, unreadCount: 0 });
    const collector = await makeCollector(ctx);
    expect((await feed(collector.token).expect(403)).body.code).toBe('FORBIDDEN');
    await ctx.http().post('/api/v1/me/notifications/read').set(bearer(collector.token)).expect(403);
  });
});
