import { bearer, createTestApp, resetData, type TestContext } from './helpers.js';
import {
  createPickup,
  getPickup,
  idem,
  makeCollector,
  makeHousehold,
  publishRates,
  statusTrail,
  tomorrow,
  uploadPhoto,
} from './pickup-helpers.js';
import { dhakaToday } from '../src/common/time.js';

describe('Creating and reading pickups (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => (ctx = await createTestApp()));
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await resetData(ctx);
    await publishRates(ctx);
  });

  const post = (token: string, body: object, key = idem()) =>
    ctx.http().post('/api/v1/pickups').set(bearer(token)).set(key).send(body);

  it('creates a request at 1 km that expires at the end of its slot', async () => {
    const h = await makeHousehold(ctx);
    const p = await createPickup(ctx, h);
    expect(p).toMatchObject({
      status: 'REQUESTED',
      displayNo: expect.stringMatching(/^BW-\d+$/),
      categoryCodes: ['IRON', 'NEWSPAPER'],
      area: 'Mirpur 10',
      searchRadiusM: 1000,
      estimate: { min: 200, max: 600 }, // avg(50, 30) = 40 taka/kg x 5-15 kg
      address: { text: 'House 12, Road 4, Block C, Mirpur 10, Dhaka', note: 'Ring the bell twice' },
      household: { id: h.id, phone: null },
      collector: null,
      pickupCode: null,
      lines: [],
      weighRounds: [],
      expiresAt: `${tomorrow()}T06:00:00.000Z`, // 12:00 in Dhaka
    });
    expect(await statusTrail(ctx, p.id)).toEqual(['->REQUESTED']);
  });

  it('replays the same Idempotency-Key instead of creating a second request', async () => {
    const h = await makeHousehold(ctx);
    const body = { addressId: h.addressId, categoryCodes: ['IRON'], weightBand: 'UNDER_5', slotDate: tomorrow(), slot: 'MIDDAY' };
    const key = idem();
    const first = await post(h.token, body, key).expect(201);
    const again = await post(h.token, body, key).expect(201);
    expect(again.body.id).toBe(first.body.id);
    const [{ n }] = await ctx.db.query(`SELECT count(*)::int AS n FROM pickups`);
    expect(n).toBe(1);

    const changed = await post(h.token, { ...body, slot: 'AFTERNOON' }, key).expect(400);
    expect(changed.body.message).toMatch(/different data/);
    const missing = await ctx.http().post('/api/v1/pickups').set(bearer(h.token)).send(body).expect(400);
    expect(missing.body.message).toMatch(/Idempotency-Key/);
  });

  it('refuses unknown categories, unpublished rates, ended slots and far-off days', async () => {
    const h = await makeHousehold(ctx);
    const base = { addressId: h.addressId, categoryCodes: ['IRON'], weightBand: 'UNDER_5', slotDate: tomorrow(), slot: 'MORNING' };
    expect((await post(h.token, { ...base, categoryCodes: ['GOLD'] }).expect(400)).body.details).toEqual({ categoryCodes: ['GOLD'] });

    await ctx.db.query(`DELETE FROM daily_rates WHERE category_id = (SELECT id FROM categories WHERE code = 'CARTON')`);
    expect((await post(h.token, { ...base, categoryCodes: ['CARTON'] }).expect(400)).body.message).toMatch(/not published/);

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await post(h.token, { ...base, slotDate: yesterday }).expect(400);
    const farAhead = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    await post(h.token, { ...base, slotDate: farAhead }).expect(400);
    await post(h.token, { ...base, weightBand: 'HEAVY' }).expect(400);
  });

  it('takes electronics on their own, with no estimate', async () => {
    const h = await makeHousehold(ctx);
    const p = await createPickup(ctx, h, { categoryCodes: ['ELECTRONICS'], weightBand: 'UNDER_5' });
    expect(p.estimate).toBeNull();
  });

  it('allows a later slot today only while it has not ended', async () => {
    const h = await makeHousehold(ctx);
    const res = await post(h.token, {
      addressId: h.addressId,
      categoryCodes: ['IRON'],
      weightBand: 'UNDER_5',
      slotDate: dhakaToday(),
      slot: 'AFTERNOON',
    });
    const dhakaHour = Number(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', hour12: false }));
    expect(res.status).toBe(dhakaHour < 18 ? 201 : 400);
  });

  it('uses only the household’s own address, and only households can request', async () => {
    const h = await makeHousehold(ctx);
    const other = await makeHousehold(ctx);
    await post(other.token, { addressId: h.addressId, categoryCodes: ['IRON'], weightBand: 'UNDER_5', slotDate: tomorrow(), slot: 'MORNING' }).expect(404);
    const collector = await makeCollector(ctx);
    await post(collector.token, { addressId: h.addressId, categoryCodes: ['IRON'], weightBand: 'UNDER_5', slotDate: tomorrow(), slot: 'MORNING' }).expect(403);
  });

  it('shows a pickup only to its household (and admins), never to other users', async () => {
    const h = await makeHousehold(ctx);
    const p = await createPickup(ctx, h);
    await getPickup(ctx, h.token, p.id).expect(200);
    await getPickup(ctx, (await makeHousehold(ctx)).token, p.id).expect(404);
    await getPickup(ctx, (await makeCollector(ctx)).token, p.id).expect(404);
    await getPickup(ctx, h.token, '00000000-0000-4000-8000-000000000000').expect(404);
    await getPickup(ctx, h.token, 'not-a-uuid').expect(400);
  });

  it('lets the household add item photos, which show as download links', async () => {
    const h = await makeHousehold(ctx);
    const p = await createPickup(ctx, h);
    const slot = await ctx.http().post(`/api/v1/pickups/${p.id}/photos`).set(bearer(h.token)).send({ kind: 'ITEMS', contentType: 'image/png' }).expect(201);
    expect(slot.body).toMatchObject({ photoId: expect.any(String), uploadUrl: expect.stringContaining(`pickups/${p.id}/`), expiresAt: expect.any(String) });
    expect(slot.body.uploadUrl).toMatch(/\.png$/);
    await uploadPhoto(ctx, h.token, p.id, 'ITEMS');
    const view = (await getPickup(ctx, h.token, p.id).expect(200)).body;
    expect(view.photos).toHaveLength(2);
    expect(view.photos[0]).toMatchObject({ kind: 'ITEMS', weighVersion: null, url: expect.stringContaining('download') });

    await ctx.http().post(`/api/v1/pickups/${p.id}/photos`).set(bearer(h.token)).send({ kind: 'SCALE' }).expect(403);
  });

  it('lists own pickups newest first, with filters and a cursor', async () => {
    const h = await makeHousehold(ctx);
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push((await createPickup(ctx, h)).id);
    await ctx.http().post(`/api/v1/pickups/${ids[0]}/cancel`).set(bearer(h.token)).send({ reason: 'Sold it' }).expect(200);

    const page1 = await ctx.http().get('/api/v1/me/pickups?limit=2').set(bearer(h.token)).expect(200);
    expect(page1.body.items.map((p: { id: string }) => p.id)).toEqual([ids[2], ids[1]]);
    expect(page1.body.nextCursor).toEqual(expect.any(String));
    const page2 = await ctx.http().get(`/api/v1/me/pickups?limit=2&cursor=${page1.body.nextCursor}`).set(bearer(h.token)).expect(200);
    expect(page2.body).toEqual({ items: [expect.objectContaining({ id: ids[0] })], nextCursor: null });

    const active = await ctx.http().get('/api/v1/me/pickups?status=ACTIVE').set(bearer(h.token)).expect(200);
    expect(active.body.items).toHaveLength(2);
    const cancelled = await ctx.http().get('/api/v1/me/pickups?status=CANCELLED').set(bearer(h.token)).expect(200);
    expect(cancelled.body.items.map((p: { status: string }) => p.status)).toEqual(['CANCELLED']);

    const other = await makeHousehold(ctx);
    expect((await ctx.http().get('/api/v1/me/pickups').set(bearer(other.token)).expect(200)).body.items).toEqual([]);
    await ctx.http().get('/api/v1/me/pickups?cursor=garbage').set(bearer(h.token)).expect(400);
  });
});
