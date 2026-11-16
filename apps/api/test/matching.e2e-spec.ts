import { bearer, createTestApp, resetData, type TestContext } from './helpers.js';
import {
  accept,
  arrive,
  createPickup,
  getPickup,
  makeAdminSession,
  makeCollector,
  makeHousehold,
  MIRPUR,
  north,
  pickupAt,
  publishRates,
  statusTrail,
} from './pickup-helpers.js';

describe('Matching: nearby, accept, release, cancel (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => (ctx = await createTestApp()));
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await resetData(ctx);
    await publishRates(ctx);
  });

  const nearby = (token: string, at: { lat: number; lng: number }) =>
    ctx.http().get(`/api/v1/collector/requests/nearby?lat=${at.lat}&lng=${at.lng}`).set(bearer(token));

  it('shows a request inside 1 km with area and distance only', async () => {
    const h = await makeHousehold(ctx);
    const p = await createPickup(ctx, h);
    const near = await makeCollector(ctx, { at: north(800) });
    const res = await nearby(near.token, north(800)).expect(200);
    expect(res.body).toEqual([
      {
        id: p.id,
        area: 'Mirpur 10',
        distanceM: expect.any(Number),
        categoryCodes: ['IRON', 'NEWSPAPER'],
        weightBand: 'FROM_5_TO_15',
        slotDate: p.slotDate,
        slot: 'MORNING',
        hasPhoto: false,
        estimate: { min: 200, max: 600 },
        requestedAt: p.requestedAt,
        expiresAt: p.expiresAt,
      },
    ]);
    expect(res.body[0].distanceM).toBeGreaterThan(780);
    expect(res.body[0].distanceM).toBeLessThan(820);
    expect(JSON.stringify(res.body)).not.toContain('House 12');
    expect((await nearby(near.token, north(1500)).expect(200)).body).toEqual([]);
  });

  it('only approved collectors see nearby requests or go online', async () => {
    const pending = await makeCollector(ctx, { status: 'PENDING' });
    expect((await nearby(pending.token, MIRPUR).expect(403)).body.code).toBe('NOT_APPROVED');
    await ctx.http().put('/api/v1/collector/status').set(bearer(pending.token)).send({ online: true, location: MIRPUR }).expect(403);
    const h = await makeHousehold(ctx);
    await nearby(h.token, MIRPUR).expect(403);
  });

  it('goes online with a location and offline again', async () => {
    const c = await makeCollector(ctx, { online: false, at: null });
    await ctx.http().put('/api/v1/collector/status').set(bearer(c.token)).send({ online: true }).expect(400);
    await ctx.http().put('/api/v1/collector/status').set(bearer(c.token)).send({ online: true, location: north(100) }).expect(204);
    let [row] = await ctx.db.query(`SELECT is_online, last_location IS NOT NULL AS has_loc FROM collector_profiles WHERE user_id = $1`, [c.id]);
    expect(row).toEqual({ is_online: true, has_loc: true });
    await ctx.http().put('/api/v1/collector/location').set(bearer(c.token)).send(north(150)).expect(204);
    await ctx.http().put('/api/v1/collector/status').set(bearer(c.token)).send({ online: false }).expect(204);
    [row] = await ctx.db.query(`SELECT is_online FROM collector_profiles WHERE user_id = $1`, [c.id]);
    expect(row.is_online).toBe(false);
  });

  it('accept copies today’s rates, creates the code, and unlocks address and phone', async () => {
    const h = await makeHousehold(ctx);
    const p = await createPickup(ctx, h);
    const c = await makeCollector(ctx, { at: north(300) });
    const res = await accept(ctx, c, p.id).expect(200);
    expect(res.body).toMatchObject({
      status: 'ACCEPTED',
      address: { text: expect.stringContaining('House 12'), lat: expect.any(Number) },
      household: { phone: h.phone },
      collector: { id: c.id, name: 'Sohel Rana' },
      pickupCode: null, // never to the collector
      acceptedAt: expect.any(String),
    });
    const snaps = await ctx.db.query(
      `SELECT c.code, pi.rate_snapshot FROM pickup_items pi JOIN categories c ON c.id = pi.category_id
        WHERE pickup_id = $1 ORDER BY c.sort_order`,
      [p.id],
    );
    expect(snaps).toEqual([{ code: 'IRON', rate_snapshot: '50.00' }, { code: 'NEWSPAPER', rate_snapshot: '30.00' }]);

    const forHousehold = (await getPickup(ctx, h.token, p.id).expect(200)).body;
    expect(forHousehold.pickupCode).toMatch(/^[0-9]{4}$/);
    expect(forHousehold.collector.phone).toBe(c.phone);
    const [{ pickup_code_hash }] = await ctx.db.query(`SELECT pickup_code_hash FROM pickups WHERE id = $1`, [p.id]);
    // Stored as a SHA-256 hex digest, never the plain code. (A substring check would fail by chance
    // about 1 run in 100, since 4 digits can appear inside a hex digest.)
    expect(pickup_code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(pickup_code_hash).not.toBe(forHousehold.pickupCode);

    // A rate change after accept does not touch the locked rate
    await publishRates(ctx, { IRON: 70 });
    expect((await getPickup(ctx, h.token, p.id)).body.estimate).toEqual({ min: 200, max: 600 });
    expect(await statusTrail(ctx, p.id)).toEqual(['->REQUESTED', 'REQUESTED>ACCEPTED']);
  });

  it('first accept wins when five collectors accept at once', async () => {
    const h = await makeHousehold(ctx);
    const p = await createPickup(ctx, h);
    const collectors = await Promise.all([1, 2, 3, 4, 5].map((i) => makeCollector(ctx, { at: north(i * 100) })));
    const results = await Promise.all(collectors.map((c) => accept(ctx, c, p.id)));
    const statuses = results.map((r) => r.status).sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409, 409, 409, 409]);
    expect(results.filter((r) => r.status === 409).every((r) => r.body.code === 'ALREADY_TAKEN')).toBe(true);
    const [{ n }] = await ctx.db.query(`SELECT count(*)::int AS n FROM status_events WHERE pickup_id = $1 AND to_status = 'ACCEPTED'`, [p.id]);
    expect(n).toBe(1);
  });

  it('refuses collectors who are too far, offline or not approved', async () => {
    const h = await makeHousehold(ctx);
    const p = await createPickup(ctx, h);
    const far = await makeCollector(ctx, { at: north(1500) });
    const res = await accept(ctx, far, p.id).expect(422);
    expect(res.body).toMatchObject({ code: 'OUT_OF_RANGE', details: { searchRadiusM: 1000 } });
    const offline = await makeCollector(ctx, { online: false });
    expect((await accept(ctx, offline, p.id).expect(422)).body.message).toMatch(/Go online/);
    const pending = await makeCollector(ctx, { status: 'PENDING' });
    expect((await accept(ctx, pending, p.id).expect(403)).body.code).toBe('NOT_APPROVED');
    await ctx.db.query(`UPDATE collector_profiles SET last_seen_at = now() - interval '11 minutes' WHERE user_id = $1`, [far.id]);
    await accept(ctx, far, p.id).expect(422);
  });

  it('release reopens the request at 1 km and clears collector, code and rates', async () => {
    const { household, collector, id } = await pickupAt(ctx, 'ACCEPTED');
    const stranger = await makeCollector(ctx);
    await ctx.http().post(`/api/v1/pickups/${id}/release`).set(bearer(stranger.token)).send({}).expect(404);
    await ctx.http().post(`/api/v1/pickups/${id}/release`).set(bearer(collector.token)).send({ reason: 'Van broke down' }).expect(204);

    const view = (await getPickup(ctx, household.token, id).expect(200)).body;
    expect(view).toMatchObject({ status: 'REQUESTED', collector: null, pickupCode: null, searchRadiusM: 1000, acceptedAt: null });
    const [row] = await ctx.db.query(`SELECT pickup_code_hash, code_attempts FROM pickups WHERE id = $1`, [id]);
    expect(row).toEqual({ pickup_code_hash: null, code_attempts: 0 });
    const snaps = await ctx.db.query(`SELECT rate_snapshot FROM pickup_items WHERE pickup_id = $1`, [id]);
    expect(snaps.every((s: { rate_snapshot: unknown }) => s.rate_snapshot === null)).toBe(true);
    await getPickup(ctx, collector.token, id).expect(404);

    // Someone else can take it now
    await accept(ctx, stranger, id).expect(200);
    expect(await statusTrail(ctx, id)).toEqual(['->REQUESTED', 'REQUESTED>ACCEPTED', 'ACCEPTED>REQUESTED', 'REQUESTED>ACCEPTED']);
  });

  it('the household can cancel before arrival but not after', async () => {
    const { household, id } = await pickupAt(ctx, 'ACCEPTED');
    const res = await ctx.http().post(`/api/v1/pickups/${id}/cancel`).set(bearer(household.token)).send({ reason: 'Sold to a neighbour' }).expect(200);
    expect(res.body).toMatchObject({ status: 'CANCELLED', cancelledAt: expect.any(String), pickupCode: null });
    const [ev] = await ctx.db.query(`SELECT actor_role, meta FROM status_events WHERE pickup_id = $1 AND to_status = 'CANCELLED'`, [id]);
    expect(ev).toEqual({ actor_role: 'HOUSEHOLD', meta: { reason: 'Sold to a neighbour' } });

    const later = await pickupAt(ctx, 'ARRIVED');
    const refused = await ctx.http().post(`/api/v1/pickups/${later.id}/cancel`).set(bearer(later.household.token)).send({}).expect(409);
    expect(refused.body).toMatchObject({ code: 'INVALID_STATE', details: { status: 'ARRIVED' } });
  });

  it('an admin can cancel any active pickup, with a reason', async () => {
    const admin = await makeAdminSession(ctx);
    const { id, collector, household } = await pickupAt(ctx, 'CONFIRMED');
    await ctx.http().post(`/api/v1/admin/pickups/${id}/cancel`).set(bearer(admin.token)).send({}).expect(400);
    await ctx.http().post(`/api/v1/admin/pickups/${id}/cancel`).set(bearer(collector.token)).send({ reason: 'x' }).expect(403);
    const res = await ctx.http().post(`/api/v1/admin/pickups/${id}/cancel`).set(bearer(admin.token)).send({ reason: 'Fraud check' }).expect(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.household.phone).toBe(household.phone); // admins see everything
    await ctx.http().post(`/api/v1/admin/pickups/${id}/cancel`).set(bearer(admin.token)).send({ reason: 'again' }).expect(409);
  });

  it('cannot accept a cancelled request', async () => {
    const h = await makeHousehold(ctx);
    const p = await createPickup(ctx, h);
    await ctx.http().post(`/api/v1/pickups/${p.id}/cancel`).set(bearer(h.token)).send({}).expect(200);
    const res = await accept(ctx, await makeCollector(ctx), p.id).expect(409);
    expect(res.body.code).toBe('INVALID_STATE');
  });

  it('keeps the arrive step for the assigned collector only', async () => {
    const { household, collector, id } = await pickupAt(ctx, 'ACCEPTED');
    const other = await makeCollector(ctx);
    await ctx.http().post(`/api/v1/pickups/${id}/arrive`).set(bearer(other.token)).send({ code: '0000' }).expect(404);
    const res = await arrive(ctx, household, collector, id);
    expect(res.body).toMatchObject({ status: 'ARRIVED', arrivedAt: expect.any(String) });
  });
});
