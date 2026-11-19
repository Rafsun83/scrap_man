import { bearer, createTestApp, resetData, signIn, type TestContext } from './helpers.js';
import {
  accept,
  createPickup,
  makeAdminSession,
  makeCollector,
  makeHousehold,
  nextPhone,
  north,
  pickupAt,
  publishRates,
  weigh,
  type Session,
} from './pickup-helpers.js';

type Item = { id: string; type: string; read: boolean; pickupId: string | null; data: Record<string, unknown> };

describe('Collector notifications and the no-show report (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => (ctx = await createTestApp()));
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await resetData(ctx);
    await publishRates(ctx);
  });

  const feed = (token: string) => ctx.http().get('/api/v1/me/notifications').set(bearer(token));
  const types = (items: Item[]) => items.map((i) => i.type);
  const dispute = (s: Session, id: string, body: object) => ctx.http().post(`/api/v1/pickups/${id}/dispute`).set(bearer(s.token)).send(body);

  describe('collector feed', () => {
    it('lists the decision on the application, then rates once approved', async () => {
      const phone = nextPhone();
      const s = await signIn(ctx, phone, 'COLLECTOR');
      const slot = (await ctx.http().post('/api/v1/collector/selfie').set(bearer(s.accessToken)).send({}).expect(201)).body;
      ctx.storage.complete(slot.uploadUrl);
      const app = { name: 'Jasim', nidNumber: '1987654321', selfiePhotoId: slot.photoId, workAreas: ['MIRPUR'], vehicleType: 'VAN', hasScale: true, acceptedAgreement: true };
      await ctx.http().post('/api/v1/collector/signup').set(bearer(s.accessToken)).send(app).expect(201);
      const admin = await makeAdminSession(ctx);
      const decide = (body: object) => ctx.http().post(`/api/v1/admin/collectors/${s.user.id}/decision`).set(bearer(admin.token)).send(body);

      await decide({ decision: 'REJECTED', note: 'Selfie is blurred' }).expect(204);
      const rejected = (await feed(s.accessToken).expect(200)).body.items as Item[];
      expect(types(rejected)).toEqual(['APPLICATION_REJECTED']);
      expect(rejected[0].data).toEqual({ note: 'Selfie is blurred' });

      await ctx.http().post('/api/v1/collector/signup').set(bearer(s.accessToken)).send(app).expect(201);
      await decide({ decision: 'APPROVED' }).expect(204);
      // The latest decision replaces the earlier one; rates published before approval are not news.
      expect(types((await feed(s.accessToken).expect(200)).body.items)).toEqual(['APPLICATION_APPROVED']);
      // Rates published after approval are listed.
      await ctx.db.query(`UPDATE daily_rates SET published_at = now() + interval '1 second'`);
      expect(types((await feed(s.accessToken).expect(200)).body.items)).toEqual(['RATES_PUBLISHED', 'APPLICATION_APPROVED']);
    });

    it("lists what the household did on the collector's pickups", async () => {
      const { household, collector, id } = await pickupAt(ctx, 'WEIGHED');
      await ctx.db.query(`UPDATE users SET name = 'Rasheda' WHERE id = $1`, [household.id]);
      await dispute(household, id, { type: 'WEIGHT', reason: 'Too low' }).expect(201);
      expect((await weigh(ctx, collector, id)).status).toBe(200);
      await ctx.http().post(`/api/v1/pickups/${id}/confirm`).set(bearer(household.token)).set({ 'Idempotency-Key': crypto.randomUUID() }).send({ paymentMethod: 'CASH' }).expect(200);
      await ctx.http().post(`/api/v1/pickups/${id}/payment`).set(bearer(collector.token)).set({ 'Idempotency-Key': crypto.randomUUID() }).send({ method: 'CASH' }).expect(200);
      await ctx.http().post(`/api/v1/pickups/${id}/rating`).set(bearer(household.token)).send({ stars: 4 }).expect(204);
      await dispute(household, id, { type: 'PAYMENT' }).expect(201);

      const items = (await feed(collector.token).expect(200)).body.items as Item[];
      expect(types(items)).toEqual(['PAYMENT_REPORTED', 'RATED', 'PICKUP_CONFIRMED', 'PICKUP_DISPUTED']);
      expect(items[0].data).toMatchObject({ householdName: 'Rasheda', method: 'CASH', amount: 625 });
      expect(items[1].data).toMatchObject({ stars: 4 });
      expect(items[2].data).toMatchObject({ householdName: 'Rasheda', method: 'CASH', amount: 625 });
      expect(items[3].data).toMatchObject({ disputeType: 'WEIGHT', disputeStatus: 'REWEIGH' });
      expect((await feed(collector.token).expect(200)).body.unreadCount).toBe(4);
      await ctx.http().post('/api/v1/me/notifications/read').set(bearer(collector.token)).expect(204);
      expect((await feed(collector.token).expect(200)).body.unreadCount).toBe(0);
    });

    it('a second weight rejection is with staff; a cancel after accept is listed', async () => {
      const { household, collector, id } = await pickupAt(ctx, 'WEIGHED');
      await dispute(household, id, { type: 'WEIGHT' }).expect(201);
      expect((await weigh(ctx, collector, id)).status).toBe(200);
      await dispute(household, id, { type: 'WEIGHT' }).expect(201);
      const accepted = await pickupAt(ctx, 'ACCEPTED');
      await ctx.http().post(`/api/v1/pickups/${accepted.id}/cancel`).set(bearer(accepted.household.token)).send({ reason: 'Sold it' }).expect(200);

      const first = (await feed(collector.token).expect(200)).body.items as Item[];
      expect(first.filter((i) => i.type === 'PICKUP_DISPUTED').map((i) => i.data.disputeStatus)).toEqual(['ADMIN_REVIEW', 'REWEIGH']);
      expect(types((await feed(accepted.collector.token).expect(200)).body.items)).toEqual(['PICKUP_CANCELLED']);
    });
  });

  describe('no-show', () => {
    /** An accepted pickup whose slot has started, with the collector at the door. */
    async function atTheDoor() {
      const household = await makeHousehold(ctx);
      const collector = await makeCollector(ctx, { at: north(100) });
      const p = await createPickup(ctx, household);
      await accept(ctx, collector, p.id).expect(200);
      // The booked slot started yesterday (whatever the time of day the test runs).
      await ctx.db.query(
        `UPDATE pickups SET slot_date = (now() AT TIME ZONE 'Asia/Dhaka')::date - 1, expires_at = now() + interval '1 hour' WHERE id = $1`,
        [p.id],
      );
      return { household, collector, p };
    }
    const noShow = (c: Session, id: string, body: object = {}) => ctx.http().post(`/api/v1/pickups/${id}/no-show`).set(bearer(c.token)).send(body);

    it('ends the pickup and tells the household, once the slot started and the collector is there', async () => {
      const { household, collector, p } = await atTheDoor();
      const res = await noShow(collector, p.id, { note: 'Called twice, no answer' }).expect(200);
      expect(res.body.status).toBe('CANCELLED');
      const [ev] = await ctx.db.query(`SELECT actor_role, meta FROM status_events WHERE pickup_id = $1 AND to_status = 'CANCELLED'`, [p.id]);
      expect(ev).toMatchObject({ actor_role: 'COLLECTOR', meta: { reason: 'NO_SHOW', note: 'Called twice, no answer' } });
      const items = (await feed(household.token).expect(200)).body.items as Item[];
      expect(items[0]).toMatchObject({ type: 'PICKUP_NO_SHOW', pickupId: p.id, data: { collectorName: 'Sohel Rana' } });
      // The collector's own report is not in the collector's feed.
      expect(types((await feed(collector.token).expect(200)).body.items)).toEqual([]);
    });

    it('refuses before the slot starts, away from the address, or when not accepted', async () => {
      const { collector, p } = await atTheDoor();
      // A slot two days from yesterday (tomorrow) has not started.
      await ctx.db.query(`UPDATE pickups SET slot_date = slot_date + 2 WHERE id = $1`, [p.id]);
      const early = await noShow(collector, p.id).expect(409);
      expect(early.body.details.slotStartsAt).toEqual(expect.any(String));

      // Started yesterday, but the collector is 900 m away.
      await ctx.db.query(`UPDATE pickups SET slot_date = slot_date - 2 WHERE id = $1`, [p.id]);
      await ctx.db.query(
        `UPDATE collector_profiles SET last_location = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, last_seen_at = now() WHERE user_id = $1`,
        [collector.id, north(900).lng, north(900).lat],
      );
      const far = await noShow(collector, p.id).expect(422);
      expect(far.body).toMatchObject({ code: 'OUT_OF_RANGE', details: { maxDistanceM: 200 } });

      // An old ping does not count either.
      await ctx.db.query(
        `UPDATE collector_profiles SET last_location = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, last_seen_at = now() - interval '20 minutes' WHERE user_id = $1`,
        [collector.id, north(50).lng, north(50).lat],
      );
      await noShow(collector, p.id).expect(422);

      const other = await pickupAt(ctx, 'ARRIVED');
      expect((await noShow(other.collector, other.id).expect(409)).body.code).toBe('INVALID_STATE');
      await noShow(collector, other.id).expect(404);
      const h = await makeHousehold(ctx);
      await noShow(h, p.id).expect(403);
    });
  });
});
