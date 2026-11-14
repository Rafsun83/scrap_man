import { MatchingJobs } from '../src/jobs/matching-jobs.service.js';
import { bearer, createTestApp, resetData, type TestContext } from './helpers.js';
import {
  accept,
  createPickup,
  getPickup,
  makeCollector,
  makeHousehold,
  north,
  pickupAt,
  publishRates,
  statusTrail,
} from './pickup-helpers.js';

const minutes = (n: number) => n * 60_000;

describe('Matching jobs: widening and expiry (e2e)', () => {
  let ctx: TestContext;
  let jobs: MatchingJobs;
  beforeAll(async () => {
    ctx = await createTestApp();
    jobs = ctx.app.get(MatchingJobs);
  });
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await resetData(ctx);
    await publishRates(ctx);
  });

  it('widens to 3 km after 5 minutes, not before, and only once', async () => {
    const h = await makeHousehold(ctx);
    const p = await createPickup(ctx, h);
    const start = new Date(p.requestedAt as string).getTime();

    expect((await jobs.runOnce(new Date(start + minutes(4)))).widened).toEqual([]);
    expect((await jobs.runOnce(new Date(start + minutes(5) + 1000))).widened).toEqual([p.id]);
    expect((await jobs.runOnce(new Date(start + minutes(6)))).widened).toEqual([]);

    expect((await getPickup(ctx, h.token, p.id)).body.searchRadiusM).toBe(3000);
    const [ev] = await ctx.db.query(
      `SELECT from_status, to_status, actor_id, meta FROM status_events WHERE pickup_id = $1 ORDER BY id DESC LIMIT 1`,
      [p.id],
    );
    expect(ev).toEqual({ from_status: 'REQUESTED', to_status: 'REQUESTED', actor_id: null, meta: { searchRadiusM: 3000 } });

    // A collector 2 km away can now see and accept it
    const far = await makeCollector(ctx, { at: north(2000) });
    const list = await ctx.http().get(`/api/v1/collector/requests/nearby?lat=${north(2000).lat}&lng=${north(2000).lng}`).set(bearer(far.token)).expect(200);
    expect(list.body.map((r: { id: string }) => r.id)).toEqual([p.id]);
    await accept(ctx, far, p.id).expect(200);
  });

  it('a release restarts the 5-minute clock at 1 km', async () => {
    const { collector, household, id } = await pickupAt(ctx, 'ACCEPTED');
    await ctx.db.query(`UPDATE pickups SET search_started_at = now() - interval '1 hour' WHERE id = $1`, [id]);
    await ctx.http().post(`/api/v1/pickups/${id}/release`).set(bearer(collector.token)).send({}).expect(204);
    expect((await jobs.runOnce(new Date(Date.now() + minutes(4)))).widened).toEqual([]);
    expect((await jobs.runOnce(new Date(Date.now() + minutes(6)))).widened).toEqual([id]);
    expect((await getPickup(ctx, household.token, id)).body.searchRadiusM).toBe(3000);
  });

  it('expires an unaccepted request at the end of its slot', async () => {
    const h = await makeHousehold(ctx);
    const p = await createPickup(ctx, h);
    const end = new Date(p.expiresAt as string).getTime();

    const before = await jobs.runOnce(new Date(end - 1000));
    expect(before).toEqual({ expired: [], widened: [p.id] }); // still open, and well past 5 minutes
    const swept = await jobs.runOnce(new Date(end));
    expect(swept).toEqual({ expired: [p.id], widened: [] });

    expect((await getPickup(ctx, h.token, p.id)).body.status).toBe('EXPIRED');
    expect(await statusTrail(ctx, p.id)).toEqual(['->REQUESTED', 'REQUESTED>REQUESTED', 'REQUESTED>EXPIRED']);
    const res = await accept(ctx, await makeCollector(ctx), p.id).expect(409);
    expect(res.body.code).toBe('INVALID_STATE');
  });

  it('leaves accepted pickups alone at the end of the slot', async () => {
    const { id, household } = await pickupAt(ctx, 'ACCEPTED');
    const [{ expires_at }] = await ctx.db.query(`SELECT expires_at FROM pickups WHERE id = $1`, [id]);
    expect((await jobs.runOnce(new Date(expires_at.getTime() + minutes(60)))).expired).toEqual([]);
    expect((await getPickup(ctx, household.token, id)).body.status).toBe('ACCEPTED');
  });

  it('a request past its slot end cannot be accepted even before the sweep runs', async () => {
    const h = await makeHousehold(ctx);
    const p = await createPickup(ctx, h);
    await ctx.db.query(`UPDATE pickups SET expires_at = now() - interval '1 second' WHERE id = $1`, [p.id]);
    const res = await accept(ctx, await makeCollector(ctx), p.id).expect(409);
    expect(res.body.message).toMatch(/expired/);
  });
});
