import { bearer, createTestApp, resetData, signIn, type TestContext } from './helpers.js';

const home = {
  label: 'বাসা',
  line: 'বাড়ি ১২, রোড ৪, ব্লক সি',
  area: 'Mirpur 10',
  location: { lat: 23.8069, lng: 90.3687 },
  note: 'বাড়ির নিচে কেয়ারটেকারকে বলবেন',
};
const mother = { label: 'মায়ের বাসা', line: 'ফ্ল্যাট ৩বি, রোড ২', area: 'Shyamoli', location: { lat: 23.774, lng: 90.365 } };

describe('Profile and addresses (e2e)', () => {
  let ctx: TestContext;
  let token: string;
  beforeAll(async () => (ctx = await createTestApp()));
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await resetData(ctx);
    token = (await signIn(ctx, '+8801722222222')).accessToken;
  });

  it('updates the name and language', async () => {
    const res = await ctx.http().patch('/api/v1/me').set(bearer(token)).send({ name: 'রাশেদা বেগম', language: 'EN' }).expect(200);
    expect(res.body).toMatchObject({ name: 'রাশেদা বেগম', language: 'EN' });
  });

  it('makes the first address the default and keeps the location', async () => {
    const res = await ctx.http().post('/api/v1/me/addresses').set(bearer(token)).send(home).expect(201);
    expect(res.body).toMatchObject({ label: 'বাসা', city: 'Dhaka', isDefault: true, location: home.location });
  });

  it('moves the default when a new default is added, and lists it first', async () => {
    await ctx.http().post('/api/v1/me/addresses').set(bearer(token)).send(home).expect(201);
    await ctx.http().post('/api/v1/me/addresses').set(bearer(token)).send({ ...mother, isDefault: true }).expect(201);
    const list = await ctx.http().get('/api/v1/me/addresses').set(bearer(token)).expect(200);
    expect(list.body.map((a: { label: string; isDefault: boolean }) => [a.label, a.isDefault])).toEqual([
      ['মায়ের বাসা', true],
      ['বাসা', false],
    ]);
  });

  it('edits an address', async () => {
    const created = await ctx.http().post('/api/v1/me/addresses').set(bearer(token)).send(home).expect(201);
    const res = await ctx.http().patch(`/api/v1/me/addresses/${created.body.id}`).set(bearer(token)).send({ note: '' }).expect(200);
    expect(res.body.note).toBeNull();
  });

  it('promotes another address when the default is removed', async () => {
    const first = await ctx.http().post('/api/v1/me/addresses').set(bearer(token)).send(home).expect(201);
    await ctx.http().post('/api/v1/me/addresses').set(bearer(token)).send(mother).expect(201);
    await ctx.http().delete(`/api/v1/me/addresses/${first.body.id}`).set(bearer(token)).expect(204);
    const list = await ctx.http().get('/api/v1/me/addresses').set(bearer(token)).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ label: 'মায়ের বাসা', isDefault: true });
  });

  it('rejects a location outside Bangladesh', async () => {
    const res = await ctx.http().post('/api/v1/me/addresses').set(bearer(token)).send({ ...home, location: { lat: 90.36, lng: 23.8 } });
    expect(res.status).toBe(400);
    expect(res.body.details.issues.map((i: { path: string }) => i.path)).toContain('location.lat');
  });

  it('caps saved addresses at 10', async () => {
    for (let i = 0; i < 10; i++) {
      await ctx.http().post('/api/v1/me/addresses').set(bearer(token)).send({ ...home, label: `ঠিকানা ${i}` }).expect(201);
    }
    const res = await ctx.http().post('/api/v1/me/addresses').set(bearer(token)).send(home);
    expect(res.status).toBe(400);
  });

  it('does not let one user touch another user\u2019s address', async () => {
    const created = await ctx.http().post('/api/v1/me/addresses').set(bearer(token)).send(home).expect(201);
    const other = await signIn(ctx, '+8801733333333');
    await ctx.http().delete(`/api/v1/me/addresses/${created.body.id}`).set(bearer(other.accessToken)).expect(404);
  });

  it('keeps addresses to households', async () => {
    const collector = await signIn(ctx, '+8801744444444', 'COLLECTOR');
    const res = await ctx.http().get('/api/v1/me/addresses').set(bearer(collector.accessToken));
    expect(res.status).toBe(403);
  });
});
