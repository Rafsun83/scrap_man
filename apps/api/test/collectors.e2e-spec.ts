import { dhakaToday } from '../src/common/time.js';
import { slotUtil } from '../src/modules/pickups/utils/slot.util.js';
import { bearer, createTestApp, resetData, signIn, type TestContext } from './helpers.js';
import {
  accept,
  createPickup,
  makeAdminSession,
  makeCollector,
  makeHousehold,
  MIRPUR,
  nextPhone,
  north,
  pickupAt,
  publishRates,
  weigh,
  confirm,
  pay,
  arrive,
  type Session,
} from './pickup-helpers.js';

const APPLICATION = {
  name: 'Jasim Uddin',
  nidNumber: '1987654321',
  workAreas: ['MIRPUR', 'PALLABI'],
  vehicleType: 'VAN',
  hasScale: true,
  acceptedAgreement: true,
};

describe('Collector sign-up, approval, profile and ledger (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => (ctx = await createTestApp()));
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await resetData(ctx);
    await publishRates(ctx);
  });

  /** A collector who has signed in but not applied yet. */
  async function newCollector(): Promise<Session> {
    const phone = nextPhone();
    const s = await signIn(ctx, phone, 'COLLECTOR');
    return { token: s.accessToken, id: s.user.id, phone };
  }

  async function uploadSelfie(c: Session, complete = true): Promise<string> {
    const res = await ctx.http().post('/api/v1/collector/selfie').set(bearer(c.token)).send({}).expect(201);
    expect(res.body.uploadUrl).toContain(`selfies/${c.id}/`);
    if (complete) ctx.storage.complete(res.body.uploadUrl);
    return res.body.photoId as string;
  }

  const signUp = (c: Session, body: object) => ctx.http().post('/api/v1/collector/signup').set(bearer(c.token)).send(body);
  const profile = (c: Session) => ctx.http().get('/api/v1/collector/profile').set(bearer(c.token));
  const decide = (admin: Session, userId: string, body: object) =>
    ctx.http().post(`/api/v1/admin/collectors/${userId}/decision`).set(bearer(admin.token)).send(body);

  it('runs the whole application: apply, reject with a note, apply again, approve, go online', async () => {
    const c = await newCollector();
    const admin = await makeAdminSession(ctx);
    expect((await profile(c).expect(404)).body.code).toBe('NOT_FOUND');

    const pending = await uploadSelfie(c, false);
    expect((await signUp(c, { ...APPLICATION, selfiePhotoId: pending }).expect(400)).body.code).toBe('VALIDATION_ERROR');

    const selfiePhotoId = await uploadSelfie(c);
    const applied = (await signUp(c, { ...APPLICATION, selfiePhotoId }).expect(201)).body;
    expect(applied).toMatchObject({
      userId: c.id,
      name: 'Jasim Uddin',
      phone: c.phone,
      nidNumberMasked: '19XX XX 4321',
      nidVerified: false,
      workAreas: ['MIRPUR', 'PALLABI'],
      vehicleType: 'VAN',
      hasScale: true,
      verificationStatus: 'PENDING',
      verificationNote: null,
      decidedAt: null,
      isOnline: false,
      ratingAvg: null,
      pickups30d: 0,
      releases30d: 0,
    });
    expect(applied.selfieUrl).toContain(`/download/selfies/${c.id}/`);
    expect(JSON.stringify(applied)).not.toContain('1987654321');
    expect((await ctx.http().get('/api/v1/me').set(bearer(c.token)).expect(200)).body.name).toBe('Jasim Uddin');

    // Applying twice while pending is refused; pending collectors cannot work yet.
    expect((await signUp(c, { ...APPLICATION, selfiePhotoId }).expect(409)).body.code).toBe('INVALID_STATE');
    const online = { online: true, location: MIRPUR };
    expect((await ctx.http().put('/api/v1/collector/status').set(bearer(c.token)).send(online).expect(403)).body.code).toBe(
      'NOT_APPROVED',
    );

    const queue = (await ctx.http().get('/api/v1/admin/collectors?status=PENDING').set(bearer(admin.token)).expect(200)).body;
    expect(queue.items.map((p: { userId: string }) => p.userId)).toEqual([c.id]);
    expect(queue.nextCursor).toBeNull();

    // Rejecting needs a note; the collector reads it and gets an SMS.
    await decide(admin, c.id, { decision: 'REJECTED' }).expect(400);
    await decide(admin, c.id, { decision: 'REJECTED', note: 'The selfie is blurred. Take it again in daylight.' }).expect(204);
    expect(ctx.sms.sent.at(-1)).toMatchObject({ phone: c.phone });
    expect(ctx.sms.sent.at(-1)!.message).toContain('ভাঙ্গারিওয়ালা');
    const rejected = (await profile(c).expect(200)).body;
    expect(rejected).toMatchObject({
      verificationStatus: 'REJECTED',
      verificationNote: 'The selfie is blurred. Take it again in daylight.',
    });
    expect(rejected.decidedAt).not.toBeNull();
    await decide(admin, c.id, { decision: 'APPROVED' }).expect(409);

    // Applying again clears the old decision.
    const again = (await signUp(c, { ...APPLICATION, vehicleType: 'PUSHCART', selfiePhotoId: await uploadSelfie(c) }).expect(201)).body;
    expect(again).toMatchObject({ verificationStatus: 'PENDING', verificationNote: null, decidedAt: null, vehicleType: 'PUSHCART' });

    await decide(admin, c.id, { decision: 'APPROVED' }).expect(204);
    expect((await profile(c).expect(200)).body.verificationStatus).toBe('APPROVED');
    expect((await signUp(c, { ...APPLICATION, selfiePhotoId }).expect(409)).body.code).toBe('INVALID_STATE');
    await ctx.http().put('/api/v1/collector/status').set(bearer(c.token)).send(online).expect(204);
    await ctx.http().get(`/api/v1/collector/requests/nearby?lat=${MIRPUR.lat}&lng=${MIRPUR.lng}`).set(bearer(c.token)).expect(200);
  });

  it("refuses another collector's selfie and invalid applications", async () => {
    const a = await newCollector();
    const b = await newCollector();
    const theirs = await uploadSelfie(a);
    await signUp(b, { ...APPLICATION, selfiePhotoId: theirs }).expect(400);
    const mine = await uploadSelfie(b);
    await signUp(b, { ...APPLICATION, selfiePhotoId: mine, nidNumber: '12345' }).expect(400);
    await signUp(b, { ...APPLICATION, selfiePhotoId: mine, workAreas: [] }).expect(400);
    await signUp(b, { ...APPLICATION, selfiePhotoId: mine, workAreas: ['ATLANTIS'] }).expect(400);
    await signUp(b, { ...APPLICATION, selfiePhotoId: mine, workAreas: ['MIRPUR', 'MIRPUR'] }).expect(400);
    await signUp(b, { ...APPLICATION, selfiePhotoId: mine, acceptedAgreement: false }).expect(400);
    await signUp(b, { ...APPLICATION, selfiePhotoId: mine }).expect(201);
  });

  it('keeps collector and admin routes to their roles', async () => {
    const household = await makeHousehold(ctx);
    const c = await newCollector();
    await ctx.http().post('/api/v1/collector/selfie').set(bearer(household.token)).send({}).expect(403);
    await ctx.http().get('/api/v1/collector/profile').set(bearer(household.token)).expect(403);
    await ctx.http().get('/api/v1/collector/ledger?from=2026-11-01&to=2026-11-02').set(bearer(household.token)).expect(403);
    await ctx.http().get('/api/v1/admin/collectors').set(bearer(c.token)).expect(403);
    await decide(c, c.id, { decision: 'APPROVED' }).expect(403);

    const admin = await makeAdminSession(ctx);
    expect((await decide(admin, household.id, { decision: 'APPROVED' }).expect(404)).body.code).toBe('NOT_FOUND');
    await decide(admin, 'not-a-uuid', { decision: 'APPROVED' }).expect(400);
  });

  it('pages the admin queue oldest first', async () => {
    const admin = await makeAdminSession(ctx);
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const c = await newCollector();
      await signUp(c, { ...APPLICATION, selfiePhotoId: await uploadSelfie(c) }).expect(201);
      ids.push(c.id);
    }
    const first = (await ctx.http().get('/api/v1/admin/collectors?status=PENDING&limit=2').set(bearer(admin.token)).expect(200)).body;
    expect(first.items.map((p: { userId: string }) => p.userId)).toEqual(ids.slice(0, 2));
    const second = (
      await ctx
        .http()
        .get(`/api/v1/admin/collectors?status=PENDING&limit=2&cursor=${first.nextCursor}`)
        .set(bearer(admin.token))
        .expect(200)
    ).body;
    expect(second.items.map((p: { userId: string }) => p.userId)).toEqual([ids[2]]);
    expect(second.nextCursor).toBeNull();
    await ctx.http().get('/api/v1/admin/collectors?cursor=nonsense').set(bearer(admin.token)).expect(400);
    expect((await ctx.http().get('/api/v1/admin/collectors?status=APPROVED').set(bearer(admin.token)).expect(200)).body.items).toEqual(
      [],
    );
  });

  it('changes work details without touching the verification', async () => {
    const c = await newCollector();
    const patch = (body: object) => ctx.http().patch('/api/v1/collector/profile').set(bearer(c.token)).send(body);
    await patch({ hasScale: false }).expect(404);
    await signUp(c, { ...APPLICATION, selfiePhotoId: await uploadSelfie(c) }).expect(201);
    const changed = (await patch({ workAreas: ['UTTARA'], vehicleType: 'ON_FOOT' }).expect(200)).body;
    expect(changed).toMatchObject({ workAreas: ['UTTARA'], vehicleType: 'ON_FOOT', hasScale: true, verificationStatus: 'PENDING' });
    await patch({}).expect(400);
    await patch({ workAreas: ['NOWHERE'] }).expect(400);
    await patch({ vehicleType: 'BICYCLE' }).expect(400);
  });

  describe('ledger', () => {
    const ledger = (c: Session, from: string, to: string) =>
      ctx.http().get(`/api/v1/collector/ledger?from=${from}&to=${to}`).set(bearer(c.token));

    it('sums paid pickups by method and category for the Dhaka day', async () => {
      const household = await makeHousehold(ctx);
      const collector = await makeCollector(ctx, { at: north(200) });

      // Cash sale: 9.5 kg iron + 5 kg newspaper = 475 + 150.
      const a = await createPickup(ctx, household);
      await accept(ctx, collector, a.id).expect(200);
      await arrive(ctx, household, collector, a.id);
      expect((await weigh(ctx, collector, a.id)).status).toBe(200);
      await confirm(ctx, household, a.id).expect(200);
      await pay(ctx, collector, a.id).expect(200);

      // bKash sale: 4 kg iron + 2 kg carton found at the door = 200 + 36.
      const b = await createPickup(ctx, household, { slot: 'AFTERNOON' });
      await accept(ctx, collector, b.id).expect(200);
      await arrive(ctx, household, collector, b.id);
      expect(
        (
          await weigh(ctx, collector, b.id, [
            { categoryCode: 'IRON', kg: 4 },
            { categoryCode: 'CARTON', kg: 2 },
          ])
        ).status,
      ).toBe(200);
      await confirm(ctx, household, b.id, { paymentMethod: 'BKASH', walletNumber: '+8801712345678' }).expect(200);
      await pay(ctx, collector, b.id, { method: 'BKASH', trxId: '9KX7ABC123' }).expect(200);

      const today = dhakaToday();
      const res = (await ledger(collector, today, today).expect(200)).body;
      expect(res).toMatchObject({
        from: today,
        to: today,
        totalPaid: 861,
        totalKg: 20.5,
        pickupCount: 2,
        byMethod: { CASH: 625, BKASH: 236, NAGAD: 0 },
        byCategory: [
          { categoryCode: 'IRON', kg: 13.5 },
          { categoryCode: 'NEWSPAPER', kg: 5 },
          { categoryCode: 'CARTON', kg: 2 },
        ],
      });
      expect(res.payments).toEqual([
        expect.objectContaining({ pickupId: b.id, method: 'BKASH', trxId: '9KX7ABC123', amount: 236 }),
        expect.objectContaining({ pickupId: a.id, method: 'CASH', trxId: null, amount: 625 }),
      ]);
      expect(res.payments[0].householdName).toBeNull();

      // Another collector's ledger and an earlier range are empty.
      const other = await makeCollector(ctx);
      expect((await ledger(other, today, today).expect(200)).body).toMatchObject({ totalPaid: 0, pickupCount: 0, payments: [] });
      const yesterday = slotUtil.addDays(today, -1);
      expect((await ledger(collector, yesterday, yesterday).expect(200)).body.pickupCount).toBe(0);

      // A "payment not received" report takes the pickup out until it is settled.
      await ctx.http().post(`/api/v1/pickups/${b.id}/dispute`).set(bearer(household.token)).send({ type: 'PAYMENT' }).expect(201);
      expect((await ledger(collector, today, today).expect(200)).body).toMatchObject({ totalPaid: 625, pickupCount: 1 });

      // The profile counts the completed pickups of the last 30 days.
      expect((await ctx.http().get('/api/v1/collector/profile').set(bearer(collector.token)).expect(200)).body.pickups30d).toBe(2);
    });

    it('checks the date range', async () => {
      const c = await makeCollector(ctx);
      await ledger(c, '2026-11-10', '2026-11-09').expect(400);
      await ledger(c, '2026-01-01', '2026-11-01').expect(400);
      await ledger(c, '2026-02-30', '2026-03-01').expect(400);
      await ledger(c, 'yesterday', '2026-03-01').expect(400);
      await ledger(c, '2026-08-11', '2026-11-10').expect(200); // 92 days inclusive
    });
  });

  it('counts releases in the profile and lists past pickups for the collector', async () => {
    const { collector, id } = await pickupAt(ctx, 'COMPLETED');
    const household = await makeHousehold(ctx);
    const open = await createPickup(ctx, household);
    await accept(ctx, collector, open.id).expect(200);
    await ctx.http().post(`/api/v1/pickups/${open.id}/release`).set(bearer(collector.token)).send({ reason: 'Van broke down' }).expect(204);

    const me = (await ctx.http().get('/api/v1/collector/profile').set(bearer(collector.token)).expect(200)).body;
    expect(me).toMatchObject({ pickups30d: 1, releases30d: 1 });

    const past = (await ctx.http().get('/api/v1/me/pickups?status=PAST').set(bearer(collector.token)).expect(200)).body;
    expect(past.items.map((p: { id: string }) => p.id)).toEqual([id]);
    const active = (await ctx.http().get('/api/v1/me/pickups?status=ACTIVE').set(bearer(collector.token)).expect(200)).body;
    expect(active.items).toEqual([]);
  });
});
