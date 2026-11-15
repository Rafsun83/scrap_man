import { bearer, createTestApp, resetData, type TestContext } from './helpers.js';
import { accept, arrive, createPickup, getPickup, makeCollector, makeHousehold, north, pickupAt, publishRates } from './pickup-helpers.js';

describe('Household screens: summary, collector location, rating (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => (ctx = await createTestApp()));
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await resetData(ctx);
    await publishRates(ctx);
  });

  describe('GET /me/summary', () => {
    it('totals only completed pickups of this household', async () => {
      const { household } = await pickupAt(ctx, 'COMPLETED');
      // An unfinished second pickup does not count.
      await createPickup(ctx, { ...household, addressId: (await ctx.http().get('/api/v1/me/addresses').set(bearer(household.token))).body[0].id });
      const res = await ctx.http().get('/api/v1/me/summary').set(bearer(household.token)).expect(200);
      // Default weigh: iron 9.5 kg x 50 + newspaper 5 kg x 30
      expect(res.body).toEqual({ completedCount: 1, totalKg: 14.5, totalAmount: 625 });
    });

    it('is zero for a new household and refused for collectors', async () => {
      const household = await makeHousehold(ctx);
      const collector = await makeCollector(ctx);
      await ctx.http().get('/api/v1/me/summary').set(bearer(household.token)).expect(200, { completedCount: 0, totalKg: 0, totalAmount: 0 });
      const res = await ctx.http().get('/api/v1/me/summary').set(bearer(collector.token)).expect(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  describe('Pickup.collectorLocation', () => {
    it('gives the household the collector\'s last position while ACCEPTED only', async () => {
      const household = await makeHousehold(ctx);
      const collector = await makeCollector(ctx, { at: north(200) });
      const { id } = await createPickup(ctx, household);

      expect((await getPickup(ctx, household.token, id).expect(200)).body.collectorLocation).toBeNull();
      await accept(ctx, collector, id).expect(200);

      const seen = (await getPickup(ctx, household.token, id).expect(200)).body.collectorLocation;
      expect(seen.lat).toBeCloseTo(north(200).lat, 5);
      expect(Date.parse(seen.at)).not.toBeNaN();
      expect((await getPickup(ctx, collector.token, id).expect(200)).body.collectorLocation).toBeNull();

      await ctx.http().put('/api/v1/collector/location').set(bearer(collector.token)).send(north(50)).expect(204);
      expect((await getPickup(ctx, household.token, id).expect(200)).body.collectorLocation.lat).toBeCloseTo(north(50).lat, 5);

      await arrive(ctx, household, collector, id);
      expect((await getPickup(ctx, household.token, id).expect(200)).body.collectorLocation).toBeNull();
    });
  });

  describe('Pickup.rating', () => {
    it('is null until rated, then shows the stars to the household and the collector', async () => {
      const { household, collector, id } = await pickupAt(ctx, 'COMPLETED');
      expect((await getPickup(ctx, household.token, id).expect(200)).body.rating).toBeNull();
      await ctx.http().post(`/api/v1/pickups/${id}/rating`).set(bearer(household.token)).send({ stars: 4, comment: 'Quick' }).expect(204);
      for (const viewer of [household, collector]) {
        const rating = (await getPickup(ctx, viewer.token, id).expect(200)).body.rating;
        expect(rating).toMatchObject({ stars: 4, comment: 'Quick' });
      }
    });
  });
});
