import { bearer, createTestApp, resetData, type TestContext } from './helpers.js';
import {
  accept,
  arrive,
  confirm,
  createPickup,
  getPickup,
  idem,
  makeCollector,
  makeHousehold,
  north,
  pay,
  pickupAt,
  publishRates,
  statusTrail,
  uploadPhoto,
  weigh,
} from './pickup-helpers.js';

describe('Pickup code, weighing, confirmation and payment (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => (ctx = await createTestApp()));
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await resetData(ctx);
    await publishRates(ctx);
  });

  const tryCode = (token: string, id: string, code: string) =>
    ctx.http().post(`/api/v1/pickups/${id}/arrive`).set(bearer(token)).send({ code });

  it('counts wrong codes and locks the pickup on the fifth', async () => {
    const { household, collector, id } = await pickupAt(ctx, 'ACCEPTED');
    const right = (await getPickup(ctx, household.token, id)).body.pickupCode as string;
    const wrong = right === '0000' ? '1111' : '0000';

    for (const left of [4, 3, 2, 1]) {
      const res = await tryCode(collector.token, id, wrong).expect(422);
      expect(res.body).toMatchObject({ code: 'CODE_MISMATCH', details: { attemptsLeft: left } });
    }
    expect((await tryCode(collector.token, id, wrong).expect(423)).body.code).toBe('CODE_LOCKED');
    expect((await tryCode(collector.token, id, right).expect(423)).body.code).toBe('CODE_LOCKED');

    const view = (await getPickup(ctx, household.token, id)).body;
    expect(view).toMatchObject({ status: 'ACCEPTED', codeLocked: true });
    await ctx.http().post(`/api/v1/pickups/${id}/release`).set(bearer(collector.token)).send({}).expect(423);
    await tryCode(collector.token, id, '12a4').expect(400);
  });

  it('the right code moves the pickup to ARRIVED and hides the code', async () => {
    const { household, collector, id } = await pickupAt(ctx, 'ACCEPTED');
    await arrive(ctx, household, collector, id);
    const view = (await getPickup(ctx, household.token, id)).body;
    expect(view).toMatchObject({ status: 'ARRIVED', pickupCode: null });
  });

  it('a scale photo, when sent, must be an uploaded photo of this pickup', async () => {
    const { collector, id } = await pickupAt(ctx, 'ARRIVED');
    const lines = [{ categoryCode: 'IRON', kg: 9.5 }];
    const post = (scalePhotoId: string) =>
      ctx.http().post(`/api/v1/pickups/${id}/weights`).set(bearer(collector.token)).set(idem()).send({ lines, scalePhotoId });

    const notUploaded = await ctx.http().post(`/api/v1/pickups/${id}/photos`).set(bearer(collector.token)).send({ kind: 'SCALE' }).expect(201);
    expect((await post(notUploaded.body.photoId).expect(422)).body).toMatchObject({ code: 'SCALE_PHOTO_REQUIRED', message: expect.stringMatching(/finished uploading/) });
    expect((await post('00000000-0000-4000-8000-000000000000').expect(422)).body.code).toBe('SCALE_PHOTO_REQUIRED');

    const other = await pickupAt(ctx, 'ARRIVED');
    const otherPhoto = await uploadPhoto(ctx, other.collector.token, other.id, 'SCALE');
    expect((await post(otherPhoto).expect(422)).body.code).toBe('SCALE_PHOTO_REQUIRED');

    const good = await uploadPhoto(ctx, collector.token, id, 'SCALE');
    await post(good).expect(200);
  });

  it('weights can be sent without a scale photo, and a re-weigh too', async () => {
    const { household, collector, id } = await pickupAt(ctx, 'ARRIVED');
    const send = (kg: number, extra: object = {}) =>
      ctx.http().post(`/api/v1/pickups/${id}/weights`).set(bearer(collector.token)).set(idem()).send({ lines: [{ categoryCode: 'IRON', kg }], ...extra });

    const first = await send(9.5).expect(200);
    expect(first.body).toMatchObject({ status: 'WEIGHED', weighRounds: [{ version: 1, scalePhotoId: null }] });
    expect(first.body.photos.filter((ph: { kind: string }) => ph.kind === 'SCALE')).toEqual([]);

    await ctx.http().post(`/api/v1/pickups/${id}/dispute`).set(bearer(household.token)).send({ type: 'WEIGHT', reason: 'Too low' }).expect(201);
    const again = await send(10, { scalePhotoId: null }).expect(200);
    expect(again.body.weighRounds.map((r: { version: number; scalePhotoId: string | null }) => [r.version, r.scalePhotoId])).toEqual([
      [1, null],
      [2, null],
    ]);
  });

  it('computes every amount on the server from the locked rates', async () => {
    const household = await makeHousehold(ctx);
    const collector = await makeCollector(ctx, { at: north(100) });
    const p = await createPickup(ctx, household, { categoryCodes: ['IRON', 'NEWSPAPER', 'ELECTRONICS'] });
    await accept(ctx, collector, p.id).expect(200);
    await publishRates(ctx, { IRON: 99 }); // too late: rates were copied at accept
    await arrive(ctx, household, collector, p.id);

    const res = await weigh(ctx, collector, p.id, [
      { categoryCode: 'IRON', kg: 9.5 },
      { categoryCode: 'NEWSPAPER', kg: 3.3 },
      { categoryCode: 'ELECTRONICS', kg: 4, quotedAmount: 350 },
    ]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'WEIGHED',
      weighVersion: 1,
      lines: [
        { categoryCode: 'IRON', kg: 9.5, rate: 50, amount: 475 },
        { categoryCode: 'NEWSPAPER', kg: 3.3, rate: 30, amount: 99 },
        { categoryCode: 'ELECTRONICS', kg: 4, rate: null, amount: 350 },
      ],
      totalKg: 16.8,
      totalAmount: 924,
      weighRounds: [{ version: 1, totalKg: 16.8, totalAmount: 924, weighedBy: 'COLLECTOR', scalePhotoId: expect.any(String) }],
    });
    expect(res.body.photos.find((ph: { kind: string }) => ph.kind === 'SCALE').weighVersion).toBe(1);
  });

  it('refuses unknown categories, duplicates, or wrong pricing', async () => {
    const { collector, id } = await pickupAt(ctx, 'ARRIVED');
    const bad = async (lines: object[]) => (await weigh(ctx, collector, id, lines as never)).status;
    expect(await bad([{ categoryCode: 'GOLD', kg: 2 }])).toBe(400);
    expect(await bad([{ categoryCode: 'CARTON', kg: 2 }, { categoryCode: 'CARTON', kg: 3 }])).toBe(400);
    expect(await bad([{ categoryCode: 'IRON', kg: 2 }, { categoryCode: 'IRON', kg: 3 }])).toBe(400);
    expect(await bad([{ categoryCode: 'IRON', kg: 2, quotedAmount: 100 }])).toBe(400);
    expect(await bad([{ categoryCode: 'IRON', kg: 2.25 }])).toBe(400);
    expect(await bad([{ categoryCode: 'IRON', kg: 0 }])).toBe(400);
    expect(await bad([])).toBe(400);
  });

  it('shows the locked rates to the collector and household from accept on', async () => {
    const household = await makeHousehold(ctx);
    const collector = await makeCollector(ctx, { at: north(100) });
    const p = await createPickup(ctx, household);
    expect((await getPickup(ctx, household.token, p.id).expect(200)).body.lockedRates).toBeNull();
    await accept(ctx, collector, p.id).expect(200);
    await publishRates(ctx, { IRON: 99 }); // a correction later the same day does not change the locked rate
    const expected = [
      { categoryCode: 'IRON', rate: 50 },
      { categoryCode: 'NEWSPAPER', rate: 30 },
    ];
    expect((await getPickup(ctx, collector.token, p.id).expect(200)).body.lockedRates).toEqual(expected);
    expect((await getPickup(ctx, household.token, p.id).expect(200)).body.lockedRates).toEqual(expected);
  });

  it('adds an item found at the door at the rate in effect now', async () => {
    const { household, collector, id } = await pickupAt(ctx, 'ARRIVED');
    const res = await weigh(ctx, collector, id, [
      { categoryCode: 'IRON', kg: 9.5 },
      { categoryCode: 'CARTON', kg: 4 },
      { categoryCode: 'ELECTRONICS', kg: 3, quotedAmount: 250 },
    ]);
    expect(res.status).toBe(200);
    expect(res.body.categoryCodes).toEqual(['IRON', 'NEWSPAPER', 'CARTON', 'ELECTRONICS']);
    expect(res.body.lines).toEqual([
      { categoryCode: 'IRON', kg: 9.5, rate: 50, amount: 475 },
      { categoryCode: 'CARTON', kg: 4, rate: 18, amount: 72 },
      { categoryCode: 'ELECTRONICS', kg: 3, rate: null, amount: 250 },
    ]);
    expect(res.body.totalAmount).toBe(797);
    expect(res.body.lockedRates).toContainEqual({ categoryCode: 'CARTON', rate: 18 });
    expect((await getPickup(ctx, household.token, id).expect(200)).body.totalAmount).toBe(797);
  });

  it('refuses an item found at the door that has never had a rate', async () => {
    await resetData(ctx);
    await publishRates(ctx, { IRON: 50, NEWSPAPER: 30 });
    const { collector, id } = await pickupAt(ctx, 'ARRIVED');
    const res = await weigh(ctx, collector, id, [{ categoryCode: 'PLASTIC', kg: 3 }]);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    const [{ n }] = await ctx.db.query(`SELECT count(*)::int AS n FROM pickup_items WHERE pickup_id = $1`, [id]);
    expect(n).toBe(2);
  });

  it('electronics need a quoted amount', async () => {
    const household = await makeHousehold(ctx);
    const collector = await makeCollector(ctx, { at: north(100) });
    const p = await createPickup(ctx, household, { categoryCodes: ['ELECTRONICS'], weightBand: 'UNDER_5' });
    await accept(ctx, collector, p.id).expect(200);
    await arrive(ctx, household, collector, p.id);
    expect((await weigh(ctx, collector, p.id, [{ categoryCode: 'ELECTRONICS', kg: 3 }])).status).toBe(400);
  });

  it('a scale photo counts for one weigh round only', async () => {
    const { household, collector, id } = await pickupAt(ctx, 'ARRIVED');
    const photo = await uploadPhoto(ctx, collector.token, id, 'SCALE');
    const lines = [{ categoryCode: 'IRON', kg: 9.5 }];
    await ctx.http().post(`/api/v1/pickups/${id}/weights`).set(bearer(collector.token)).set(idem()).send({ lines, scalePhotoId: photo }).expect(200);
    await ctx.http().post(`/api/v1/pickups/${id}/dispute`).set(bearer(household.token)).send({ type: 'WEIGHT', reason: 'Too low' }).expect(201);
    const reuse = await ctx.http().post(`/api/v1/pickups/${id}/weights`).set(bearer(collector.token)).set(idem()).send({ lines, scalePhotoId: photo });
    expect(reuse.status).toBe(422);
    expect(reuse.body.code).toBe('SCALE_PHOTO_REQUIRED');
  });

  it('a repeated weights call with the same key returns the first result', async () => {
    const { collector, id } = await pickupAt(ctx, 'ARRIVED');
    const scalePhotoId = await uploadPhoto(ctx, collector.token, id, 'SCALE');
    const key = idem();
    const body = { lines: [{ categoryCode: 'IRON', kg: 9.5 }], scalePhotoId };
    const a = await ctx.http().post(`/api/v1/pickups/${id}/weights`).set(bearer(collector.token)).set(key).send(body).expect(200);
    const b = await ctx.http().post(`/api/v1/pickups/${id}/weights`).set(bearer(collector.token)).set(key).send(body).expect(200);
    expect(b.body).toEqual(a.body);
    const [{ n }] = await ctx.db.query(`SELECT count(DISTINCT version)::int AS n FROM weigh_lines WHERE pickup_id = $1`, [id]);
    expect(n).toBe(1);
  });

  it('confirm needs a wallet number for bKash and Nagad', async () => {
    const { household, id } = await pickupAt(ctx, 'WEIGHED');
    expect((await confirm(ctx, household, id, { paymentMethod: 'BKASH' }).expect(400)).body.message).toMatch(/bKash number/);
    await confirm(ctx, household, id, { paymentMethod: 'BKASH', walletNumber: '0171' }).expect(400);
    const res = await confirm(ctx, household, id, { paymentMethod: 'BKASH', walletNumber: '+8801812345678' }).expect(200);
    expect(res.body).toMatchObject({ status: 'CONFIRMED', paymentMethod: 'BKASH', walletNumber: '+8801812345678' });
  });

  it('cash payment completes the pickup with the server-computed amount', async () => {
    const { household, collector, id } = await pickupAt(ctx, 'CONFIRMED');
    const res = await pay(ctx, collector, id).expect(200);
    expect(res.body).toMatchObject({
      status: 'COMPLETED',
      completedAt: expect.any(String),
      payment: { method: 'CASH', amount: 625, trxId: null, status: 'PAID' },
    });
    expect(await statusTrail(ctx, id)).toEqual([
      '->REQUESTED',
      'REQUESTED>ACCEPTED',
      'ACCEPTED>ARRIVED',
      'ARRIVED>WEIGHED',
      'WEIGHED>CONFIRMED',
      'CONFIRMED>COMPLETED',
    ]);
    expect((await getPickup(ctx, household.token, id)).body.payment.amount).toBe(625);
  });

  it('bKash needs a TrxID, the confirmed method, and a TrxID used only once', async () => {
    const bkash = { paymentMethod: 'BKASH', walletNumber: '+8801812345678' };
    const a = await pickupAt(ctx, 'CONFIRMED', { confirm: bkash });
    expect((await pay(ctx, a.collector, a.id, { method: 'BKASH' }).expect(422)).body.code).toBe('TRX_ID_REQUIRED');
    expect((await pay(ctx, a.collector, a.id, { method: 'CASH' }).expect(400)).body.message).toMatch(/chose BKASH/);
    const done = await pay(ctx, a.collector, a.id, { method: 'BKASH', trxId: '9kq1xyz789' }).expect(200);
    expect(done.body.payment).toMatchObject({ method: 'BKASH', trxId: '9KQ1XYZ789', walletNumber: '+8801812345678' });

    const b = await pickupAt(ctx, 'CONFIRMED', { confirm: bkash });
    expect((await pay(ctx, b.collector, b.id, { method: 'BKASH', trxId: '9KQ1XYZ789' }).expect(409)).body.code).toBe('TRX_ID_REUSED');
    // The same TrxID is fine on another provider
    const c = await pickupAt(ctx, 'CONFIRMED', { confirm: { paymentMethod: 'NAGAD', walletNumber: '+8801812345678' } });
    await pay(ctx, c.collector, c.id, { method: 'NAGAD', trxId: '9KQ1XYZ789' }).expect(200);
  });

  it('the household rates the collector once, after completion', async () => {
    const { household, collector, id } = await pickupAt(ctx, 'COMPLETED');
    const rate = (stars: number) => ctx.http().post(`/api/v1/pickups/${id}/rating`).set(bearer(household.token)).send({ stars });
    await rate(6).expect(400);
    await rate(4).expect(204);
    await rate(5).expect(409);
    const view = (await getPickup(ctx, household.token, id)).body;
    expect(view.collector.rating).toBe(4);
    expect(collector).toBeDefined();

    const early = await pickupAt(ctx, 'WEIGHED');
    await ctx.http().post(`/api/v1/pickups/${early.id}/rating`).set(bearer(early.household.token)).send({ stars: 5 }).expect(409);
  });

  describe('refuses every move the state machine does not allow', () => {
    type Call = (s: Awaited<ReturnType<typeof pickupAt>>) => ReturnType<ReturnType<TestContext['http']>['post']>;
    const calls: Record<string, Call> = {
      'household cancels': (s) => ctx.http().post(`/api/v1/pickups/${s.id}/cancel`).set(bearer(s.household.token)).send({}),
      'collector releases': (s) => ctx.http().post(`/api/v1/pickups/${s.id}/release`).set(bearer(s.collector.token)).send({}),
      'collector arrives': (s) => ctx.http().post(`/api/v1/pickups/${s.id}/arrive`).set(bearer(s.collector.token)).send({ code: '0000' }),
      'household confirms': (s) =>
        ctx.http().post(`/api/v1/pickups/${s.id}/confirm`).set(bearer(s.household.token)).set(idem()).send({ paymentMethod: 'CASH' }),
      'household disputes weight': (s) =>
        ctx.http().post(`/api/v1/pickups/${s.id}/dispute`).set(bearer(s.household.token)).send({ type: 'WEIGHT' }),
      'collector pays': (s) => ctx.http().post(`/api/v1/pickups/${s.id}/payment`).set(bearer(s.collector.token)).set(idem()).send({ method: 'CASH' }),
      'collector asks for a scale photo': (s) =>
        ctx.http().post(`/api/v1/pickups/${s.id}/photos`).set(bearer(s.collector.token)).send({ kind: 'SCALE' }),
    };
    const refused: [Parameters<typeof pickupAt>[1], string[]][] = [
      ['ACCEPTED', ['household confirms', 'household disputes weight', 'collector pays', 'collector asks for a scale photo']],
      ['ARRIVED', ['household cancels', 'collector releases', 'collector arrives', 'household confirms', 'collector pays']],
      ['WEIGHED', ['household cancels', 'collector releases', 'collector arrives', 'collector pays', 'collector asks for a scale photo']],
      ['CONFIRMED', ['household cancels', 'collector arrives', 'household confirms', 'household disputes weight']],
      ['COMPLETED', ['household cancels', 'collector releases', 'household confirms', 'household disputes weight', 'collector pays']],
    ];
    for (const [stage, names] of refused) {
      it(`while ${stage}`, async () => {
        const s = await pickupAt(ctx, stage);
        for (const name of names) {
          const res = await calls[name](s);
          expect([res.status, res.body.code], `${stage}: ${name}`).toEqual([409, 'INVALID_STATE']);
        }
      });
    }
  });
});
