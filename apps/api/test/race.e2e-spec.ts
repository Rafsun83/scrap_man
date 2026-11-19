import { randomUUID } from 'node:crypto';
import { bearer, createTestApp, resetData, type TestContext } from './helpers.js';
import { accept, createPickup, makeCollector, makeHousehold, north, pickupAt, publishRates, type Session } from './pickup-helpers.js';

describe('Races: first accept wins, one TrxID, one action per key (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => (ctx = await createTestApp()));
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await resetData(ctx);
    await publishRates(ctx);
  });

  /** Approved collectors around the address; clears the per-IP OTP counter every 8 sign-ins (the limit is 10). */
  async function collectors(n: number): Promise<Session[]> {
    const out: Session[] = [];
    for (let i = 0; i < n; i++) {
      if (i > 0 && i % 8 === 0) {
        const keys = await ctx.redis.keys('bw:otp:rl:*');
        if (keys.length) await ctx.redis.del(...keys);
      }
      out.push(await makeCollector(ctx, { at: north(50 + i * 10) }));
    }
    return out;
  }

  it('20 collectors accept at once: exactly one wins, the rest get ALREADY_TAKEN, one accept is recorded', async () => {
    const household = await makeHousehold(ctx);
    const p = await createPickup(ctx, household);
    const many = await collectors(20);
    const results = await Promise.all(many.map((c) => accept(ctx, c, p.id)));
    const statuses = results.map((r) => r.status).sort((x, y) => x - y);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(19);
    expect(results.filter((r) => r.status === 409).every((r) => r.body.code === 'ALREADY_TAKEN')).toBe(true);
    const [{ n }] = await ctx.db.query(`SELECT count(*)::int AS n FROM status_events WHERE pickup_id = $1 AND to_status = 'ACCEPTED'`, [p.id]);
    expect(n).toBe(1);
    const winner = many[results.findIndex((r) => r.status === 200)];
    const [row] = await ctx.db.query(`SELECT collector_id FROM pickups WHERE id = $1`, [p.id]);
    expect(row.collector_id).toBe(winner.id);
  });

  it('two payments with the same bKash TrxID at once: one succeeds', async () => {
    const opts = { confirm: { paymentMethod: 'BKASH', walletNumber: '+8801712345678' } };
    const a = await pickupAt(ctx, 'CONFIRMED', opts);
    const keys = await ctx.redis.keys('bw:otp:rl:*');
    if (keys.length) await ctx.redis.del(...keys);
    const b = await pickupAt(ctx, 'CONFIRMED', opts);
    const pay = (c: Session, id: string) =>
      ctx.http().post(`/api/v1/pickups/${id}/payment`).set(bearer(c.token)).set({ 'Idempotency-Key': randomUUID() }).send({ method: 'BKASH', trxId: 'SAMETRX123' });
    const results = await Promise.all([pay(a.collector, a.id), pay(b.collector, b.id)]);
    expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)!.body.code).toBe('TRX_ID_REUSED');
    const [{ n }] = await ctx.db.query(`SELECT count(*)::int AS n FROM payments WHERE trx_id = 'SAMETRX123'`);
    expect(n).toBe(1);
  });

  it('the same request sent five times at once with one Idempotency-Key creates one pickup', async () => {
    const household = await makeHousehold(ctx);
    const key = randomUUID();
    const body = { addressId: household.addressId, categoryCodes: ['IRON'], weightBand: 'FROM_5_TO_15', slotDate: new Date(Date.now() + 86_400_000 + 6 * 3_600_000).toISOString().slice(0, 10), slot: 'MORNING' };
    const send = () => ctx.http().post('/api/v1/pickups').set(bearer(household.token)).set({ 'Idempotency-Key': key }).send(body);
    const results = await Promise.all([send(), send(), send(), send(), send()]);
    // The first is created; repeats either return the same answer or are told to retry while it runs.
    expect(results.every((r) => r.status === 201 || (r.status === 409 && r.body.code === 'INVALID_STATE'))).toBe(true);
    const ids = new Set(results.filter((r) => r.status === 201).map((r) => r.body.id));
    expect(ids.size).toBe(1);
    const [{ n }] = await ctx.db.query(`SELECT count(*)::int AS n FROM pickups WHERE household_id = $1`, [household.id]);
    expect(n).toBe(1);
  });
});
