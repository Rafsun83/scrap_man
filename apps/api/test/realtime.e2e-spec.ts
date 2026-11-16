import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { MatchingJobsService } from '../src/modules/jobs/services/matching-jobs.service.js';
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
  type Session,
} from './pickup-helpers.js';

/** A connected client that records every event it receives. */
interface Client {
  socket: Socket;
  events: { name: string; payload: Record<string, unknown> }[];
  named: (name: string) => Record<string, unknown>[];
}

describe('Live events over Socket.IO (e2e)', () => {
  let ctx: TestContext;
  let url: string;
  const clients: Socket[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.listen(0);
    url = `http://127.0.0.1:${((ctx.app.getHttpServer() as unknown as Server).address() as AddressInfo).port}`;
  });
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await resetData(ctx);
    await publishRates(ctx);
  });
  afterEach(() => {
    for (const s of clients.splice(0)) s.disconnect();
  });

  async function connect(session: Session): Promise<Client> {
    const socket = io(url, { auth: { token: session.token }, transports: ['websocket'], forceNew: true });
    clients.push(socket);
    const events: Client['events'] = [];
    socket.onAny((name: string, payload: Record<string, unknown>) => events.push({ name, payload }));
    await new Promise<void>((resolve, reject) => {
      socket.once('ready', () => resolve());
      socket.once('unauthorized', () => reject(new Error('unauthorized')));
      setTimeout(() => reject(new Error('no ready event')), 3000);
    });
    return { socket, events, named: (name) => events.filter((e) => e.name === name).map((e) => e.payload) };
  }

  /** Lets in-flight emits arrive. */
  const settle = () => new Promise((r) => setTimeout(r, 150));

  it('refuses a socket without a valid token', async () => {
    const socket = io(url, { auth: { token: 'nope' }, transports: ['websocket'], forceNew: true });
    clients.push(socket);
    const reason = await new Promise<string>((resolve) => socket.on('disconnect', resolve));
    expect(reason).toBe('io server disconnect');
  });

  it('request.created reaches collectors inside the radius, each with their own distance', async () => {
    const near = await connect(await makeCollector(ctx, { at: north(500) }));
    const far = await connect(await makeCollector(ctx, { at: north(2000) }));
    const offline = await connect(await makeCollector(ctx, { at: north(100), online: false }));
    const admin = await connect(await makeAdminSession(ctx));

    const p = await createPickup(ctx, await makeHousehold(ctx));
    await settle();
    const [got] = near.named('request.created');
    expect(got).toMatchObject({ id: p.id, area: 'Mirpur 10', categoryCodes: ['IRON', 'NEWSPAPER'] });
    expect(got.distanceM as number).toBeGreaterThan(480);
    expect(JSON.stringify(got)).not.toContain('House 12');
    expect(far.named('request.created')).toEqual([]);
    expect(offline.named('request.created')).toEqual([]);
    expect(admin.named('request.created')).toHaveLength(1);

    // After widening, the collector 2 km away hears about it; the near one is not told twice
    await ctx.app.get(MatchingJobsService).runOnce(new Date(Date.now() + 6 * 60_000));
    await settle();
    expect(far.named('request.created')).toHaveLength(1);
    expect(near.named('request.created')).toHaveLength(1);
  });

  it('accept tells the household and takes the request away from other collectors', async () => {
    const household = await makeHousehold(ctx);
    const winner = await makeCollector(ctx, { at: north(200) });
    const other = await makeCollector(ctx, { at: north(400) });
    const [hc, wc, oc] = await Promise.all([connect(household), connect(winner), connect(other)]);

    const p = await createPickup(ctx, household);
    await accept(ctx, winner, p.id).expect(200);
    await settle();
    expect(hc.named('pickup.accepted')).toEqual([
      { pickupId: p.id, displayNo: p.displayNo, status: 'ACCEPTED', at: expect.any(String) },
    ]);
    expect(wc.named('pickup.accepted')).toHaveLength(1);
    expect(oc.named('request.taken')).toEqual([{ pickupId: p.id, reason: 'ACCEPTED' }]);
    expect(wc.named('request.taken')).toEqual([]);
    expect(oc.named('pickup.accepted')).toEqual([]); // not their pickup
  });

  it('collector.location reaches the household while ACCEPTED', async () => {
    const { household, collector, id } = await pickupAt(ctx, 'ACCEPTED');
    const hc = await connect(household);
    await ctx.http().put('/api/v1/collector/location').set(bearer(collector.token)).send(north(150)).expect(204);
    await settle();
    expect(hc.named('collector.location')).toEqual([
      { pickupId: id, lat: north(150).lat, lng: north(150).lng, at: expect.any(String) },
    ]);
  });

  it('five wrong codes alert admins with pickup.code_locked', async () => {
    const { household, collector, id } = await pickupAt(ctx, 'ACCEPTED');
    const admin = await connect(await makeAdminSession(ctx));
    const hc = await connect(household);
    const code = (await getPickup(ctx, household.token, id)).body.pickupCode;
    const wrong = code === '0000' ? '1111' : '0000';
    for (let i = 0; i < 5; i++) {
      await ctx.http().post(`/api/v1/pickups/${id}/arrive`).set(bearer(collector.token)).send({ code: wrong });
    }
    await settle();
    expect(admin.named('pickup.code_locked')).toEqual([
      { pickupId: id, displayNo: expect.stringMatching(/^BW-/), collectorId: collector.id, at: expect.any(String) },
    ]);
    expect(hc.named('pickup.code_locked')).toEqual([]);
  });

  it('every step of a pickup reaches both sides', async () => {
    const household = await makeHousehold(ctx);
    const collector = await makeCollector(ctx, { at: north(100) });
    const [hc, cc] = await Promise.all([connect(household), connect(collector)]);
    const { id } = await createPickup(ctx, household);
    await accept(ctx, collector, id).expect(200);
    const code = (await getPickup(ctx, household.token, id)).body.pickupCode;
    await ctx.http().post(`/api/v1/pickups/${id}/arrive`).set(bearer(collector.token)).send({ code }).expect(200);
    const photo = await ctx.http().post(`/api/v1/pickups/${id}/photos`).set(bearer(collector.token)).send({ kind: 'SCALE' });
    ctx.storage.complete(photo.body.uploadUrl);
    await ctx.http().post(`/api/v1/pickups/${id}/weights`).set(bearer(collector.token)).set({ 'Idempotency-Key': 'w1' })
      .send({ lines: [{ categoryCode: 'IRON', kg: 4 }], scalePhotoId: photo.body.photoId }).expect(200);
    await ctx.http().post(`/api/v1/pickups/${id}/dispute`).set(bearer(household.token)).send({ type: 'WEIGHT' }).expect(201);
    const photo2 = await ctx.http().post(`/api/v1/pickups/${id}/photos`).set(bearer(collector.token)).send({ kind: 'SCALE' });
    ctx.storage.complete(photo2.body.uploadUrl);
    await ctx.http().post(`/api/v1/pickups/${id}/weights`).set(bearer(collector.token)).set({ 'Idempotency-Key': 'w2' })
      .send({ lines: [{ categoryCode: 'IRON', kg: 4.5 }], scalePhotoId: photo2.body.photoId }).expect(200);
    await ctx.http().post(`/api/v1/pickups/${id}/confirm`).set(bearer(household.token)).set({ 'Idempotency-Key': 'c1' })
      .send({ paymentMethod: 'CASH' }).expect(200);
    await ctx.http().post(`/api/v1/pickups/${id}/payment`).set(bearer(collector.token)).set({ 'Idempotency-Key': 'p1' })
      .send({ method: 'CASH' }).expect(200);
    await settle();

    const expected = [
      'pickup.accepted',
      'pickup.arrived',
      'pickup.weighed',
      'pickup.disputed',
      'dispute.opened',
      'pickup.weighed',
      'dispute.resolved',
      'pickup.confirmed',
      'pickup.paid',
    ];
    const pickupEvents = (c: { events: { name: string }[] }) =>
      c.events.map((e) => e.name).filter((n) => n.startsWith('pickup.') || n.startsWith('dispute.'));
    expect(pickupEvents(hc)).toEqual(expected);
    expect(pickupEvents(cc)).toEqual(expected);
  });

  it('cancelling tells the household and the collectors who saw the request', async () => {
    const household = await makeHousehold(ctx);
    const near = await connect(await makeCollector(ctx, { at: north(300) }));
    const hc = await connect(household);
    const p = await createPickup(ctx, household);
    await ctx.http().post(`/api/v1/pickups/${p.id}/cancel`).set(bearer(household.token)).send({}).expect(200);
    await settle();
    expect(near.named('request.taken')).toEqual([{ pickupId: p.id, reason: 'CANCELLED' }]);
    expect(hc.named('pickup.cancelled')).toHaveLength(1);
  });

  it('expiry tells the household and nearby collectors', async () => {
    const household = await makeHousehold(ctx);
    const near = await connect(await makeCollector(ctx, { at: north(300) }));
    const hc = await connect(household);
    const p = await createPickup(ctx, household);
    await ctx.app.get(MatchingJobsService).runOnce(new Date(p.expiresAt as string));
    await settle();
    expect(hc.named('request.expired')).toEqual([{ pickupId: p.id, displayNo: p.displayNo, status: 'EXPIRED', at: expect.any(String) }]);
    expect(near.named('request.taken')).toEqual([{ pickupId: p.id, reason: 'EXPIRED' }]);
  });

  it("an admin's decision on an application reaches the collector and admins only", async () => {
    const applicant = await makeCollector(ctx, { status: 'PENDING', online: false });
    const bystander = await connect(await makeCollector(ctx));
    const admin = await makeAdminSession(ctx);
    const cc = await connect(applicant);
    const ac = await connect(admin);
    await ctx
      .http()
      .post(`/api/v1/admin/collectors/${applicant.id}/decision`)
      .set(bearer(admin.token))
      .send({ decision: 'APPROVED' })
      .expect(204);
    await settle();
    const payload = { userId: applicant.id, verificationStatus: 'APPROVED', verificationNote: null, at: expect.any(String) };
    expect(cc.named('collector.verification')).toEqual([payload]);
    expect(ac.named('collector.verification')).toEqual([payload]);
    expect(bystander.named('collector.verification')).toEqual([]);
  });
});
