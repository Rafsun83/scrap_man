import { dhakaToday } from '../src/common/time.js';
import { bearer, createTestApp, makeAdmin, resetData, signIn, type TestContext } from './helpers.js';

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('Categories and daily rates (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  beforeAll(async () => (ctx = await createTestApp()));
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await resetData(ctx);
    admin = (await makeAdmin(ctx, '+8801700000000')).accessToken;
  });

  it('lists the six categories in order, without sign-in', async () => {
    const res = await ctx.http().get('/api/v1/categories').expect(200);
    expect(res.body.map((c: { code: string }) => c.code)).toEqual([
      'IRON', 'NEWSPAPER', 'PLASTIC', 'CARTON', 'ALUMINIUM', 'ELECTRONICS',
    ]);
    expect(res.body[0]).toMatchObject({ nameBn: 'লোহা', pricingType: 'PER_KG' });
  });

  it('shows no rates before any are published', async () => {
    const res = await ctx.http().get('/api/v1/rates/today').expect(200);
    expect(res.body.publishedAt).toBeNull();
    expect(res.body.rates.every((r: { ratePerKg: unknown }) => r.ratePerKg === null)).toBe(true);
  });

  it('publishes today\u2019s rates and shows the change from the previous day', async () => {
    const today = dhakaToday();
    await ctx.db.query(
      `INSERT INTO daily_rates (category_id, effective_date, rate_per_kg)
       SELECT id, $1, 48 FROM categories WHERE code = 'IRON'`,
      [addDays(today, -1)],
    );
    await ctx
      .http()
      .put('/api/v1/admin/rates')
      .set(bearer(admin))
      .send({ effectiveDate: today, rates: [{ categoryCode: 'IRON', ratePerKg: 50 }, { categoryCode: 'NEWSPAPER', ratePerKg: 30 }] })
      .expect(204);

    const res = await ctx.http().get('/api/v1/rates/today').expect(200);
    expect(res.body.effectiveDate).toBe(today);
    expect(res.body.rates.find((r: { categoryCode: string }) => r.categoryCode === 'IRON')).toEqual({
      categoryCode: 'IRON', ratePerKg: 50, changeFromYesterday: 2,
    });
    expect(res.body.rates.find((r: { categoryCode: string }) => r.categoryCode === 'ELECTRONICS').ratePerKg).toBeNull();
  });

  it('lets an admin correct today\u2019s rate', async () => {
    const today = dhakaToday();
    const put = (rate: number) =>
      ctx.http().put('/api/v1/admin/rates').set(bearer(admin))
        .send({ effectiveDate: today, rates: [{ categoryCode: 'IRON', ratePerKg: rate }] }).expect(204);
    await put(50);
    await put(52);
    const res = await ctx.http().get('/api/v1/rates/today').expect(200);
    expect(res.body.rates[0].ratePerKg).toBe(52);
  });

  it('refuses past dates, unknown categories and electronics', async () => {
    const today = dhakaToday();
    const send = (body: object) => ctx.http().put('/api/v1/admin/rates').set(bearer(admin)).send(body);
    expect((await send({ effectiveDate: addDays(today, -1), rates: [{ categoryCode: 'IRON', ratePerKg: 50 }] })).status).toBe(400);
    expect((await send({ effectiveDate: today, rates: [{ categoryCode: 'GOLD', ratePerKg: 50 }] })).body.message).toContain('GOLD');
    expect((await send({ effectiveDate: today, rates: [{ categoryCode: 'ELECTRONICS', ratePerKg: 50 }] })).status).toBe(400);
  });

  it('allows only admins to publish rates', async () => {
    const household = await signIn(ctx, '+8801755555555');
    const res = await ctx
      .http()
      .put('/api/v1/admin/rates')
      .set(bearer(household.accessToken))
      .send({ effectiveDate: dhakaToday(), rates: [{ categoryCode: 'IRON', ratePerKg: 50 }] });
    expect(res.status).toBe(403);
  });
});
