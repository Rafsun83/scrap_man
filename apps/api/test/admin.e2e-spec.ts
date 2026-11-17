import { dhakaToday } from '../src/common/time.js';
import { slotUtil } from '../src/modules/pickups/utils/slot.util.js';
import { bearer, createTestApp, resetData, type TestContext } from './helpers.js';
import {
  accept,
  createPickup,
  getPickup,
  makeAdminSession,
  makeCollector,
  makeHousehold,
  north,
  pickupAt,
  publishRates,
  weigh,
  type Session,
} from './pickup-helpers.js';

describe('Admin panel endpoints (e2e)', () => {
  let ctx: TestContext;
  let admin: Session;
  beforeAll(async () => (ctx = await createTestApp()));
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await resetData(ctx);
    await publishRates(ctx);
    admin = await makeAdminSession(ctx);
  });

  const get = (path: string, token = admin.token) => ctx.http().get(`/api/v1${path}`).set(bearer(token));
  const dispute = (s: Session, id: string, body: object) => ctx.http().post(`/api/v1/pickups/${id}/dispute`).set(bearer(s.token)).send(body);

  /** Six releases by this collector in the last days (more than ADMIN_ATTENTION.maxReleases30d). */
  async function addReleases(collectorId: string, pickupId: string, n: number) {
    for (let i = 0; i < n; i++) {
      await ctx.db.query(
        `INSERT INTO status_events (pickup_id, from_status, to_status, actor_id, actor_role, meta, at)
         VALUES ($1, 'ACCEPTED', 'REQUESTED', $2, 'COLLECTOR', '{"release": true}', now() - ($3 || ' days')::interval)`,
        [pickupId, collectorId, String(i)],
      );
    }
  }

  it('counts pickups by status and lists what needs attention, most urgent first', async () => {
    // A request waiting 2 hours, a locked code, a dispute with staff, a collector with too many releases.
    const h = await makeHousehold(ctx);
    const waiting = await createPickup(ctx, h);
    await ctx.db.query(`UPDATE pickups SET requested_at = now() - interval '2 hours' WHERE id = $1`, [waiting.id]);

    const locked = await pickupAt(ctx, 'ACCEPTED');
    await ctx.db.query(`UPDATE pickups SET code_attempts = 5 WHERE id = $1`, [locked.id]);

    const disputed = await pickupAt(ctx, 'WEIGHED');
    await dispute(disputed.household, disputed.id, { type: 'WEIGHT' }).expect(201);
    expect((await weigh(ctx, disputed.collector, disputed.id)).status).toBe(200);
    await dispute(disputed.household, disputed.id, { type: 'WEIGHT', reason: 'Still wrong' }).expect(201);

    await pickupAt(ctx, 'COMPLETED');
    await addReleases(locked.collector.id, locked.id, 6);
    await makeCollector(ctx, { status: 'PENDING' });

    const res = (await get('/admin/overview').expect(200)).body;
    expect(res.counts).toEqual({
      requested: 1,
      accepted: 1,
      weighing: 0,
      disputed: 1,
      confirmed: 0,
      completedToday: 1,
      pendingApplications: 1,
      openDisputes: 1,
    });
    expect(res.attention.map((a: { kind: string }) => a.kind)).toEqual(['CODE_LOCKED', 'DISPUTE_REVIEW', 'WAITING_TOO_LONG', 'RELEASES']);
    expect(res.attention[0]).toMatchObject({ pickupId: locked.id, userId: locked.collector.id, name: 'Sohel Rana' });
    expect(res.attention[1]).toMatchObject({ pickupId: disputed.id, displayNo: expect.stringMatching(/^BW-\d+$/) });
    expect(res.attention[2]).toMatchObject({ pickupId: waiting.id, area: 'Mirpur 10' });
    expect(res.attention[3]).toMatchObject({ userId: locked.collector.id, count: 6, pickupId: null });
  });

  it('a few releases and a fresh request are not flagged', async () => {
    const { collector, id } = await pickupAt(ctx, 'ACCEPTED');
    await addReleases(collector.id, id, 5);
    await createPickup(ctx, await makeHousehold(ctx));
    expect((await get('/admin/overview').expect(200)).body.attention).toEqual([]);
  });

  it('maps open requests and online collectors, busy or free', async () => {
    const h = await makeHousehold(ctx);
    const open = await createPickup(ctx, h);
    await ctx.db.query(`UPDATE pickups SET requested_at = now() - interval '61 minutes' WHERE id = $1`, [open.id]);
    const busy = await pickupAt(ctx, 'ACCEPTED');
    const free = await makeCollector(ctx, { at: north(900) });
    await makeCollector(ctx, { online: false });

    const res = (await get('/admin/map').expect(200)).body;
    expect(res.requests).toEqual([
      { pickupId: open.id, displayNo: open.displayNo, area: 'Mirpur 10', lat: expect.any(Number), lng: expect.any(Number), requestedAt: expect.any(String), overdue: true },
    ]);
    const byId = Object.fromEntries(res.collectors.map((c: { userId: string; busy: boolean }) => [c.userId, c.busy]));
    expect(byId).toEqual({ [busy.collector.id]: true, [free.id]: false });
  });

  it('searches pickups by status group, area, BW number, phone, user and date, with paging', async () => {
    const done = await pickupAt(ctx, 'COMPLETED');
    const h = await makeHousehold(ctx);
    const a = await createPickup(ctx, h);
    const b = await createPickup(ctx, h, { slot: 'AFTERNOON', slotDate: slotUtil.addDays(dhakaToday(), 2) });
    const ids = (body: { items: { id: string }[] }) => body.items.map((p) => p.id);

    expect(ids((await get('/admin/pickups?group=ACTIVE').expect(200)).body)).toEqual([b.id, a.id]);
    expect(ids((await get('/admin/pickups?group=PAST').expect(200)).body)).toEqual([done.id]);
    expect(ids((await get('/admin/pickups?status=COMPLETED').expect(200)).body)).toEqual([done.id]);
    expect((await get('/admin/pickups?area=mirpur').expect(200)).body.items).toHaveLength(3);
    expect((await get('/admin/pickups?area=Gulshan').expect(200)).body.items).toHaveLength(0);
    expect(ids((await get(`/admin/pickups?q=${String(b.displayNo)}`).expect(200)).body)).toEqual([b.id]);
    expect(ids((await get(`/admin/pickups?q=${h.phone.slice(-6)}`).expect(200)).body)).toEqual([b.id, a.id]);
    expect(ids((await get(`/admin/pickups?userId=${done.collector.id}`).expect(200)).body)).toEqual([done.id]);
    expect(ids((await get(`/admin/pickups?date=${String(b.slotDate)}`).expect(200)).body)).toEqual([b.id]);

    const first = (await get('/admin/pickups?limit=2').expect(200)).body;
    expect(first.items).toHaveLength(2);
    const second = (await get(`/admin/pickups?limit=2&cursor=${first.nextCursor}`).expect(200)).body;
    expect(ids(second)).toEqual([done.id]);
    expect(second.nextCursor).toBeNull();

    // Admins see the address and both phones; updatedAt is the latest status change.
    const row = (await get(`/admin/pickups?status=COMPLETED`).expect(200)).body.items[0];
    expect(row.address.text).toContain('House 12');
    expect(row.household.phone).toBe(done.household.phone);
    const lastEvent = (await get(`/admin/pickups/${row.id}/events`).expect(200)).body.at(-1);
    expect(row.updatedAt).toBe(lastEvent.at);
    await get('/admin/pickups?group=SOON').expect(400);
  });

  it('shows the timeline with who changed what', async () => {
    const { id } = await pickupAt(ctx, 'COMPLETED');
    const events = (await get(`/admin/pickups/${id}/events`).expect(200)).body;
    expect(events.map((e: { from: string | null; to: string }) => `${e.from ?? '-'}>${e.to}`)).toEqual([
      '->REQUESTED',
      'REQUESTED>ACCEPTED',
      'ACCEPTED>ARRIVED',
      'ARRIVED>WEIGHED',
      'WEIGHED>CONFIRMED',
      'CONFIRMED>COMPLETED',
    ]);
    expect(events[1]).toMatchObject({ actorRole: 'COLLECTOR', actorName: 'Sohel Rana' });
    expect(events[3].meta).toMatchObject({ version: 1, totalAmount: '625.00' });
    await get('/admin/pickups/00000000-0000-4000-8000-000000000000/events').expect(404);
  });

  it('gives rates for one date next to the previous rate', async () => {
    const today = dhakaToday();
    const tomorrow = slotUtil.addDays(today, 1);
    const before = (await get(`/admin/rates?date=${tomorrow}`).expect(200)).body;
    expect(before).toMatchObject({ date: tomorrow, publishedAt: null, publishedByName: null });
    expect(before.rates.find((r: { categoryCode: string }) => r.categoryCode === 'IRON')).toEqual({
      categoryCode: 'IRON',
      pricingType: 'PER_KG',
      rate: null,
      previousRate: 50,
      previousDate: today,
    });
    expect(before.rates.find((r: { categoryCode: string }) => r.categoryCode === 'ELECTRONICS')).toMatchObject({
      pricingType: 'ON_INSPECTION',
      rate: null,
    });

    await ctx.http().put('/api/v1/admin/rates').set(bearer(admin.token)).send({ effectiveDate: tomorrow, rates: [{ categoryCode: 'IRON', ratePerKg: 52 }] }).expect(204);
    const after = (await get(`/admin/rates?date=${tomorrow}`).expect(200)).body;
    expect(after.publishedByName).toBe('Ops');
    expect(after.publishedAt).not.toBeNull();
    expect(after.rates.find((r: { categoryCode: string }) => r.categoryCode === 'IRON')).toMatchObject({ rate: 52, previousRate: 50 });
    expect((await get('/admin/rates').expect(200)).body.date).toBe(today);
    await get('/admin/rates?date=tomorrow').expect(400);
  });

  it('lists disputes with the pickup area, status and both names, filtered by type', async () => {
    const w = await pickupAt(ctx, 'WEIGHED');
    await dispute(w.household, w.id, { type: 'WEIGHT', reason: 'Too low' }).expect(201);
    const p = await pickupAt(ctx, 'COMPLETED');
    await dispute(p.household, p.id, { type: 'PAYMENT' }).expect(201);

    const all = (await get('/admin/disputes').expect(200)).body;
    expect(all).toHaveLength(2);
    const payment = (await get('/admin/disputes?type=PAYMENT').expect(200)).body;
    expect(payment).toEqual([
      expect.objectContaining({ pickupId: p.id, type: 'PAYMENT', status: 'ADMIN_REVIEW', pickupStatus: 'COMPLETED', area: 'Mirpur 10', householdName: null, collectorName: 'Sohel Rana' }),
    ]);
  });

  it('lists households and collectors with their figures, searchable and paged', async () => {
    const sale = await pickupAt(ctx, 'COMPLETED');
    await ctx.db.query(`UPDATE users SET name = 'Rasheda Begum' WHERE id = $1`, [sale.household.id]);
    const other = await makeHousehold(ctx);
    const { collector, id } = await pickupAt(ctx, 'ACCEPTED');
    await addReleases(collector.id, id, 6);

    const households = (await get('/admin/users?role=HOUSEHOLD').expect(200)).body;
    // Newest account first: the household made by the second pickupAt, then `other`, then the first sale's.
    expect(households.items).toHaveLength(3);
    expect(households.items[1].id).toBe(other.id);
    expect(households.items[2].id).toBe(sale.household.id);
    const rasheda = households.items.find((u: { id: string }) => u.id === sale.household.id);
    expect(rasheda).toMatchObject({
      role: 'HOUSEHOLD',
      name: 'Rasheda Begum',
      status: 'ACTIVE',
      statusNote: null,
      releaseFlag: false,
      household: { area: 'Mirpur 10', completedCount: 1, totalReceived: 625 },
      collector: null,
    });

    const byName = (await get('/admin/users?role=HOUSEHOLD&q=rasheda').expect(200)).body.items;
    expect(byName.map((u: { id: string }) => u.id)).toEqual([sale.household.id]);
    const byPhone = (await get(`/admin/users?role=HOUSEHOLD&q=0${other.phone.slice(4)}`).expect(200)).body.items;
    expect(byPhone.map((u: { id: string }) => u.id)).toEqual([other.id]);

    const collectors = (await get('/admin/users?role=COLLECTOR').expect(200)).body.items;
    const flagged = collectors.find((u: { id: string }) => u.id === collector.id);
    expect(flagged).toMatchObject({
      releaseFlag: true,
      household: null,
      collector: { workAreas: [], pickups30d: 0, releases30d: 6, verificationStatus: 'APPROVED', isOnline: true, ratingAvg: null },
    });
    expect(collectors.find((u: { id: string }) => u.id === sale.collector.id).collector.pickups30d).toBe(1);

    const page = (await get('/admin/users?role=HOUSEHOLD&limit=1').expect(200)).body;
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).not.toBeNull();
    await get('/admin/users').expect(400);
    await get('/admin/users?role=ADMIN').expect(400);
  });

  it('flags and suspends users; a suspended collector is offline and blocked', async () => {
    const collector = await makeCollector(ctx);
    const household = await makeHousehold(ctx);
    const setStatus = (userId: string, body: object) =>
      ctx.http().put(`/api/v1/admin/users/${userId}/status`).set(bearer(admin.token)).send(body);

    await setStatus(household.id, { status: 'FLAGGED', note: 'Cancelled 4 times this week' }).expect(204);
    const row = (await get(`/admin/users?role=HOUSEHOLD`).expect(200)).body.items[0];
    expect(row).toMatchObject({ status: 'FLAGGED', statusNote: 'Cancelled 4 times this week' });
    await get('/me', household.token).expect(200); // flagged users can still use the app

    await setStatus(collector.id, { status: 'SUSPENDED', note: 'Payment reports' }).expect(204);
    const [{ is_online }] = await ctx.db.query(`SELECT is_online FROM collector_profiles WHERE user_id = $1`, [collector.id]);
    expect(is_online).toBe(false);
    expect((await get('/me', collector.token).expect(403)).body.code).toBe('FORBIDDEN');

    await setStatus(collector.id, { status: 'ACTIVE' }).expect(204);
    await get('/me', collector.token).expect(200);

    expect((await setStatus(admin.id, { status: 'SUSPENDED' }).expect(403)).body.code).toBe('FORBIDDEN');
    await setStatus('00000000-0000-4000-8000-000000000000', { status: 'FLAGGED' }).expect(404);
    await setStatus(household.id, { status: 'BANNED' }).expect(400);
  });

  it('keeps every admin route to admins', async () => {
    const household = await makeHousehold(ctx);
    const collector = await makeCollector(ctx);
    for (const token of [household.token, collector.token]) {
      await get('/admin/overview', token).expect(403);
      await get('/admin/map', token).expect(403);
      await get('/admin/pickups', token).expect(403);
      await get('/admin/rates', token).expect(403);
      await get('/admin/users?role=HOUSEHOLD', token).expect(403);
      await ctx.http().put(`/api/v1/admin/users/${household.id}/status`).set(bearer(token)).send({ status: 'FLAGGED' }).expect(403);
    }
  });

  it('every pickup carries updatedAt, the time of its latest change', async () => {
    const h = await makeHousehold(ctx);
    const c = await makeCollector(ctx, { at: north(100) });
    const p = await createPickup(ctx, h);
    const lastAt = async () => (await get(`/admin/pickups/${p.id}/events`).expect(200)).body.at(-1).at;
    expect(p.updatedAt).toBe(await lastAt());
    const accepted = (await accept(ctx, c, p.id).expect(200)).body;
    expect(accepted.updatedAt).toBe(await lastAt());
    expect(Date.parse(accepted.updatedAt)).toBeGreaterThan(Date.parse(String(p.updatedAt)));
    expect((await getPickup(ctx, h.token, p.id).expect(200)).body.updatedAt).toBe(accepted.updatedAt);
  });
});
