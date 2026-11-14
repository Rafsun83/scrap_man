import { randomUUID } from 'node:crypto';
import type request from 'supertest';
import { dhakaToday } from '../src/common/time.js';
import { addDays } from '../src/pickups/slots.js';
import { bearer, signIn, type TestContext } from './helpers.js';

/** Mirpur 10, Dhaka. Other points are placed north of it by metres. */
export const MIRPUR = { lat: 23.8069, lng: 90.3687 };
export const north = (metres: number) => ({ lat: MIRPUR.lat + metres / 111_320, lng: MIRPUR.lng });

export const tomorrow = () => addDays(dhakaToday(), 1);
export const idem = () => ({ 'Idempotency-Key': randomUUID() });

export const RATES = { IRON: 50, NEWSPAPER: 30, PLASTIC: 35, CARTON: 18, ALUMINIUM: 160 };

/** Today's rates (the prototype's sample numbers). */
export async function publishRates(ctx: TestContext, rates: Record<string, number> = RATES): Promise<void> {
  for (const [code, rate] of Object.entries(rates)) {
    await ctx.db.query(
      `INSERT INTO daily_rates (category_id, effective_date, rate_per_kg)
       SELECT id, $2, $3 FROM categories WHERE code = $1
       ON CONFLICT (category_id, effective_date) DO UPDATE SET rate_per_kg = EXCLUDED.rate_per_kg`,
      [code, dhakaToday(), rate],
    );
  }
}

export interface Session {
  token: string;
  id: string;
  phone: string;
}

let phoneSeq = 0;
/** A fresh valid phone number per call. */
export const nextPhone = () => `+88017${String(10_000_000 + ++phoneSeq).slice(-8)}`;

export async function makeHousehold(ctx: TestContext, at = MIRPUR): Promise<Session & { addressId: string }> {
  const phone = nextPhone();
  const s = await signIn(ctx, phone, 'HOUSEHOLD');
  const res = await ctx
    .http()
    .post('/api/v1/me/addresses')
    .set(bearer(s.accessToken))
    .send({ label: 'Home', line: 'House 12, Road 4, Block C', area: 'Mirpur 10', location: at, note: '3rd floor' })
    .expect(201);
  return { token: s.accessToken, id: s.user.id, phone, addressId: res.body.id };
}

export async function makeCollector(
  ctx: TestContext,
  opts: { at?: { lat: number; lng: number } | null; status?: 'APPROVED' | 'PENDING'; online?: boolean } = {},
): Promise<Session> {
  const phone = nextPhone();
  const s = await signIn(ctx, phone, 'COLLECTOR');
  const at = opts.at === undefined ? MIRPUR : opts.at;
  await ctx.db.query(
    `INSERT INTO collector_profiles (user_id, nid_number, vehicle_type, has_scale, verification_status, is_online,
                                     last_location, last_seen_at)
     VALUES ($1, '1234567890', 'VAN', true, $2, $3,
             CASE WHEN $4::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography END,
             now())`,
    [s.user.id, opts.status ?? 'APPROVED', opts.online ?? true, at?.lat ?? null, at?.lng ?? null],
  );
  await ctx.db.query(`UPDATE users SET name = 'Sohel Rana' WHERE id = $1`, [s.user.id]);
  return { token: s.accessToken, id: s.user.id, phone };
}

export async function makeAdminSession(ctx: TestContext): Promise<Session> {
  const phone = nextPhone();
  await ctx.db.query(`INSERT INTO users (phone, role, name) VALUES ($1, 'ADMIN', 'Ops')`, [phone]);
  const s = await signIn(ctx, phone);
  return { token: s.accessToken, id: s.user.id, phone };
}

export async function createPickup(
  ctx: TestContext,
  household: Session & { addressId: string },
  overrides: Record<string, unknown> = {},
) {
  const res = await ctx
    .http()
    .post('/api/v1/pickups')
    .set(bearer(household.token))
    .set(idem())
    .send({
      addressId: household.addressId,
      categoryCodes: ['IRON', 'NEWSPAPER'],
      weightBand: 'FROM_5_TO_15',
      slotDate: tomorrow(),
      slot: 'MORNING',
      note: 'Ring the bell twice',
      ...overrides,
    });
  if (res.status !== 201) throw new Error(`create failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string; [k: string]: unknown };
}

export const getPickup = (ctx: TestContext, token: string, id: string) =>
  ctx.http().get(`/api/v1/pickups/${id}`).set(bearer(token));

/** Asks for an upload slot and marks the file uploaded. */
export async function uploadPhoto(ctx: TestContext, token: string, pickupId: string, kind: 'ITEMS' | 'SCALE') {
  const res = await ctx.http().post(`/api/v1/pickups/${pickupId}/photos`).set(bearer(token)).send({ kind }).expect(201);
  ctx.storage.complete(res.body.uploadUrl);
  return res.body.photoId as string;
}

export const accept = (ctx: TestContext, collector: Session, id: string) =>
  ctx.http().post(`/api/v1/pickups/${id}/accept`).set(bearer(collector.token)).set(idem());

export async function arrive(
  ctx: TestContext,
  household: Session,
  collector: Session,
  id: string,
): Promise<request.Response> {
  const code = (await getPickup(ctx, household.token, id).expect(200)).body.pickupCode;
  return ctx.http().post(`/api/v1/pickups/${id}/arrive`).set(bearer(collector.token)).send({ code }).expect(200);
}

export async function weigh(
  ctx: TestContext,
  weigher: Session,
  id: string,
  lines: { categoryCode: string; kg: number; quotedAmount?: number }[] = [
    { categoryCode: 'IRON', kg: 9.5 },
    { categoryCode: 'NEWSPAPER', kg: 5 },
  ],
): Promise<request.Response> {
  const scalePhotoId = await uploadPhoto(ctx, weigher.token, id, 'SCALE');
  // Awaiting this resolves to the response; check `.status` on the result.
  return ctx.http().post(`/api/v1/pickups/${id}/weights`).set(bearer(weigher.token)).set(idem()).send({ lines, scalePhotoId });
}

export const confirm = (ctx: TestContext, household: Session, id: string, body: object = { paymentMethod: 'CASH' }) =>
  ctx.http().post(`/api/v1/pickups/${id}/confirm`).set(bearer(household.token)).set(idem()).send(body);

export const pay = (ctx: TestContext, collector: Session, id: string, body: object = { method: 'CASH' }) =>
  ctx.http().post(`/api/v1/pickups/${id}/payment`).set(bearer(collector.token)).set(idem()).send(body);

export type Stage = 'REQUESTED' | 'ACCEPTED' | 'ARRIVED' | 'WEIGHED' | 'CONFIRMED' | 'COMPLETED';

/** A household, a collector next door, and a pickup moved forward to `stage`. */
export async function pickupAt(ctx: TestContext, stage: Stage, opts: { payment?: object; confirm?: object } = {}) {
  const household = await makeHousehold(ctx);
  const collector = await makeCollector(ctx, { at: north(200) });
  const pickup = await createPickup(ctx, household);
  const id = pickup.id;
  const order: Stage[] = ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'WEIGHED', 'CONFIRMED', 'COMPLETED'];
  const reach = (s: Stage) => order.indexOf(stage) >= order.indexOf(s);
  if (reach('ACCEPTED')) await accept(ctx, collector, id).expect(200);
  if (reach('ARRIVED')) await arrive(ctx, household, collector, id);
  if (reach('WEIGHED')) {
    const weighed = await weigh(ctx, collector, id);
    if (weighed.status !== 200) throw new Error(`weigh failed: ${weighed.status} ${JSON.stringify(weighed.body)}`);
  }
  if (reach('CONFIRMED')) await confirm(ctx, household, id, opts.confirm).expect(200);
  if (reach('COMPLETED')) await pay(ctx, collector, id, opts.payment).expect(200);
  return { household, collector, id };
}

export async function statusTrail(ctx: TestContext, id: string): Promise<string[]> {
  const rows: { from_status: string | null; to_status: string }[] = await ctx.db.query(
    `SELECT from_status, to_status FROM status_events WHERE pickup_id = $1 ORDER BY id`,
    [id],
  );
  return rows.map((r) => `${r.from_status ?? '-'}>${r.to_status}`);
}
