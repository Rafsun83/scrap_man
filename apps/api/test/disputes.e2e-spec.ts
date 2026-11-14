import { bearer, createTestApp, resetData, type TestContext } from './helpers.js';
import {
  confirm,
  getPickup,
  makeAdminSession,
  makeCollector,
  pay,
  pickupAt,
  publishRates,
  statusTrail,
  uploadPhoto,
  weigh,
  type Session,
} from './pickup-helpers.js';

describe('Disputes (e2e)', () => {
  let ctx: TestContext;
  let admin: Session;
  beforeAll(async () => (ctx = await createTestApp()));
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await resetData(ctx);
    await publishRates(ctx);
    admin = await makeAdminSession(ctx);
  });

  const dispute = (s: Session, id: string, body: object) =>
    ctx.http().post(`/api/v1/pickups/${id}/dispute`).set(bearer(s.token)).send(body);
  const resolve = (disputeId: string, outcome: string, note = 'Checked with both sides') =>
    ctx.http().post(`/api/v1/admin/disputes/${disputeId}/resolve`).set(bearer(admin.token)).send({ outcome, note });

  it('first weight rejection: the collector re-weighs, which closes the dispute', async () => {
    const { household, collector, id } = await pickupAt(ctx, 'WEIGHED');
    const opened = await dispute(household, id, { type: 'WEIGHT', reason: 'The iron should be at least 11 kg' }).expect(201);
    expect(opened.body).toMatchObject({ type: 'WEIGHT', status: 'REWEIGH', outcome: null, displayNo: expect.stringMatching(/^BW-/) });

    const view = (await getPickup(ctx, collector.token, id)).body;
    expect(view).toMatchObject({ status: 'DISPUTED', openDispute: { id: opened.body.id, reason: 'The iron should be at least 11 kg' } });

    const res = await weigh(ctx, collector, id, [
      { categoryCode: 'IRON', kg: 10 },
      { categoryCode: 'NEWSPAPER', kg: 5 },
    ]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'WEIGHED', weighVersion: 2, totalAmount: 650, openDispute: null });
    expect(res.body.weighRounds.map((r: { version: number; totalAmount: number }) => [r.version, r.totalAmount])).toEqual([
      [1, 625],
      [2, 650],
    ]);
    const [d] = await ctx.db.query(`SELECT status, resolution FROM disputes WHERE id = $1`, [opened.body.id]);
    expect(d).toEqual({ status: 'RESOLVED', resolution: 'REWEIGHED' });
  });

  it('second weight rejection goes to admin review; the collector can no longer re-weigh', async () => {
    const { household, collector, id } = await pickupAt(ctx, 'WEIGHED');
    await dispute(household, id, { type: 'WEIGHT' }).expect(201);
    expect((await weigh(ctx, collector, id)).status).toBe(200);
    const second = await dispute(household, id, { type: 'WEIGHT', reason: 'Still too low' }).expect(201);
    expect(second.body.status).toBe('ADMIN_REVIEW');

    const blocked = await weigh(ctx, collector, id);
    expect([blocked.status, blocked.body.code]).toEqual([409, 'INVALID_STATE']);

    const list = await ctx.http().get('/api/v1/admin/disputes?status=ADMIN_REVIEW').set(bearer(admin.token)).expect(200);
    expect(list.body.map((x: { id: string }) => x.id)).toEqual([second.body.id]);
    await ctx.http().get('/api/v1/admin/disputes').set(bearer(household.token)).expect(403);
  });

  it('ACCEPT_WEIGHTS sends the pickup back to WEIGHED for the household to confirm', async () => {
    const s = await pickupAt(ctx, 'WEIGHED');
    await dispute(s.household, s.id, { type: 'WEIGHT' }).expect(201);
    await weigh(ctx, s.collector, s.id);
    const d = (await dispute(s.household, s.id, { type: 'WEIGHT' }).expect(201)).body;

    await resolve(d.id, 'PAYMENT_VERIFIED').expect(400); // not an outcome for a weight dispute
    await resolve(d.id, 'REWEIGHED').expect(400);
    const res = await resolve(d.id, 'ACCEPT_WEIGHTS', 'The re-weighed amount is fair').expect(200);
    expect(res.body).toMatchObject({ status: 'RESOLVED', outcome: 'ACCEPT_WEIGHTS', resolutionNote: 'The re-weighed amount is fair' });
    await resolve(d.id, 'ACCEPT_WEIGHTS').expect(409);

    expect((await getPickup(ctx, s.household.token, s.id)).body.status).toBe('WEIGHED');
    await confirm(ctx, s.household, s.id).expect(200);
    expect((await statusTrail(ctx, s.id)).slice(-4)).toEqual([
      'DISPUTED>WEIGHED', // collector re-weigh
      'WEIGHED>DISPUTED', // second rejection
      'DISPUTED>WEIGHED', // admin accepted the weights
      'WEIGHED>CONFIRMED',
    ]);
  });

  it('TEAM_REWEIGH: an admin posts the new weights', async () => {
    const s = await pickupAt(ctx, 'WEIGHED');
    await dispute(s.household, s.id, { type: 'WEIGHT' }).expect(201);
    await weigh(ctx, s.collector, s.id);
    const d = (await dispute(s.household, s.id, { type: 'WEIGHT' }).expect(201)).body;

    const early = await weigh(ctx, admin, s.id);
    expect(early.status).toBe(409); // must decide first
    await resolve(d.id, 'TEAM_REWEIGH', 'A team member will weigh again').expect(200);
    expect((await getPickup(ctx, s.household.token, s.id)).body.status).toBe('DISPUTED');
    expect((await weigh(ctx, s.collector, s.id)).status).toBe(409); // not the collector

    const res = await weigh(ctx, admin, s.id, [
      { categoryCode: 'IRON', kg: 11 },
      { categoryCode: 'NEWSPAPER', kg: 5 },
    ]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'WEIGHED', weighVersion: 3, totalAmount: 700 });
    expect(res.body.weighRounds[2].weighedBy).toBe('ADMIN');
  });

  it('CANCEL ends the pickup; items stay with the household', async () => {
    const s = await pickupAt(ctx, 'WEIGHED');
    await dispute(s.household, s.id, { type: 'WEIGHT' }).expect(201);
    await weigh(ctx, s.collector, s.id);
    const d = (await dispute(s.household, s.id, { type: 'WEIGHT' }).expect(201)).body;
    await resolve(d.id, 'CANCEL', 'Items stay with the household').expect(200);
    expect((await getPickup(ctx, s.household.token, s.id)).body).toMatchObject({ status: 'CANCELLED', openDispute: null });
  });

  it('payment not received: the pickup stays COMPLETED; PAY_AGAIN needs a new TrxID', async () => {
    const bkash = { paymentMethod: 'BKASH', walletNumber: '+8801812345678' };
    const s = await pickupAt(ctx, 'COMPLETED', { confirm: bkash, payment: { method: 'BKASH', trxId: 'AAA111BBB' } });
    await pay(ctx, s.collector, s.id, { method: 'BKASH', trxId: 'NEW222CCC' }).expect(409); // already paid

    const d = (await dispute(s.household, s.id, { type: 'PAYMENT', reason: 'Nothing arrived' }).expect(201)).body;
    expect(d.status).toBe('ADMIN_REVIEW');
    let view = (await getPickup(ctx, s.household.token, s.id)).body;
    expect(view).toMatchObject({ status: 'COMPLETED', payment: { status: 'REPORTED' } });

    await pay(ctx, s.collector, s.id, { method: 'BKASH', trxId: 'NEW222CCC' }).expect(409); // admin has not decided
    await resolve(d.id, 'PAY_AGAIN', 'Send the money again').expect(200);
    await pay(ctx, s.collector, s.id, { method: 'BKASH', trxId: 'AAA111BBB' }).expect(409); // same TrxID again
    await pay(ctx, s.collector, s.id, { method: 'BKASH', trxId: 'NEW222CCC' }).expect(200);
    view = (await getPickup(ctx, s.household.token, s.id)).body;
    expect(view).toMatchObject({ status: 'COMPLETED', payment: { status: 'PAID', trxId: 'NEW222CCC' } });
  });

  it('PAYMENT_VERIFIED marks the payment verified', async () => {
    const s = await pickupAt(ctx, 'COMPLETED');
    const d = (await dispute(s.household, s.id, { type: 'PAYMENT' }).expect(201)).body;
    await resolve(d.id, 'PAYMENT_VERIFIED', 'The collector showed the receipt').expect(200);
    expect((await getPickup(ctx, s.household.token, s.id)).body.payment.status).toBe('VERIFIED');
    await dispute(s.household, s.id, { type: 'PAYMENT' }).expect(409); // verified payments cannot be reported again
  });

  it('SUSPEND_COLLECTOR suspends the collector and takes them offline', async () => {
    const s = await pickupAt(ctx, 'COMPLETED');
    const d = (await dispute(s.household, s.id, { type: 'PAYMENT' }).expect(201)).body;
    await resolve(d.id, 'SUSPEND_COLLECTOR', 'Suspended until settled').expect(200);
    const [row] = await ctx.db.query(
      `SELECT u.status, cp.is_online FROM users u JOIN collector_profiles cp ON cp.user_id = u.id WHERE u.id = $1`,
      [s.collector.id],
    );
    expect(row).toEqual({ status: 'SUSPENDED', is_online: false });
    await ctx.http().get('/api/v1/me').set(bearer(s.collector.token)).expect(403);
  });

  it('behaviour reports need an accepted pickup and allow one open dispute at a time', async () => {
    const early = await pickupAt(ctx, 'REQUESTED');
    await dispute(early.household, early.id, { type: 'BEHAVIOUR' }).expect(409);

    const s = await pickupAt(ctx, 'ACCEPTED');
    const d = (await dispute(s.household, s.id, { type: 'BEHAVIOUR', reason: 'Rude on the phone' }).expect(201)).body;
    expect((await getPickup(ctx, s.household.token, s.id)).body.status).toBe('ACCEPTED'); // status unchanged
    await dispute(s.household, s.id, { type: 'OTHER' }).expect(409);
    await resolve(d.id, 'ACCEPT_WEIGHTS').expect(400);
    await resolve(d.id, 'NO_ACTION', 'Spoke to the collector').expect(200);
    await dispute(s.household, s.id, { type: 'OTHER' }).expect(201);
  });

  it('evidence photos must be the household’s own item photos of this pickup', async () => {
    const s = await pickupAt(ctx, 'WEIGHED');
    const mine = await uploadPhoto(ctx, s.household.token, s.id, 'ITEMS');
    const scale = (await ctx.db.query(`SELECT id FROM pickup_photos WHERE pickup_id = $1 AND kind = 'SCALE'`, [s.id]))[0].id;
    await dispute(s.household, s.id, { type: 'WEIGHT', photoIds: [scale] }).expect(400);
    const ok = await dispute(s.household, s.id, { type: 'WEIGHT', photoIds: [mine] }).expect(201);
    expect(ok.body.photoIds).toEqual([mine]);
  });

  it('admin cancel closes an open dispute too', async () => {
    const s = await pickupAt(ctx, 'WEIGHED');
    const d = (await dispute(s.household, s.id, { type: 'WEIGHT' }).expect(201)).body;
    await ctx.http().post(`/api/v1/admin/pickups/${s.id}/cancel`).set(bearer(admin.token)).send({ reason: 'Both agreed to stop' }).expect(200);
    const [row] = await ctx.db.query(`SELECT status, resolution FROM disputes WHERE id = $1`, [d.id]);
    expect(row).toEqual({ status: 'RESOLVED', resolution: 'CANCEL' });
  });

  it('only the pickup’s household can open a dispute', async () => {
    const s = await pickupAt(ctx, 'WEIGHED');
    await dispute(s.collector, s.id, { type: 'WEIGHT' }).expect(403);
    await dispute(await makeCollector(ctx), s.id, { type: 'WEIGHT' }).expect(403);
    await resolve('00000000-0000-4000-8000-000000000000', 'NO_ACTION').expect(404);
  });
});
