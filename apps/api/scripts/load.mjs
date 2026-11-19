// Load test: N households and N collectors run complete sales at the same time against a local API, with a
// Socket.IO client per user counting the live events that arrive. Development only.
//
//   node --env-file=.env scripts/load.mjs --local [--pairs 20] [--api http://localhost:3000] [--cleanup]
//
// Users are created straight in the database with the phone prefix +88019900 and given access tokens signed
// with the dev JWT_SECRET, because the per-IP OTP limit (10 per 10 minutes) rightly stops mass sign-ins.
// --cleanup deletes those users and their pickups afterwards.
import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';
import { io } from 'socket.io-client';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const PAIRS = Number(arg('pairs', '20'));
const API = arg('api', 'http://localhost:3000');
const CLEANUP = args.includes('--cleanup');
const PREFIX = '+88019900';

const dbUrl = process.env.DATABASE_URL ?? '';
if (!args.includes('--local') || !/@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl) || process.env.NODE_ENV === 'production') {
  console.error('Refusing: pass --local and point DATABASE_URL at a local development database.');
  process.exit(1);
}

const db = new pg.Client({ connectionString: dbUrl });
await db.connect();

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function token(id, role) {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, role, iat: now, exp: now + 3600 })}`;
  return `${body}.${createHmac('sha256', process.env.JWT_SECRET).update(body).digest('base64url')}`;
}

const timings = new Map();
async function call(label, method, path, tok, body, idem = false) {
  const headers = { Accept: 'application/json', Authorization: `Bearer ${tok}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idem) headers['Idempotency-Key'] = randomUUID();
  const t0 = performance.now();
  const res = await fetch(`${API}/api/v1${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const ms = performance.now() - t0;
  if (!timings.has(label)) timings.set(label, []);
  timings.get(label).push(ms);
  const text = await res.text();
  if (!res.ok) throw new Error(`${label}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

// 1. Users: each pair 5 km from the next, so a request reaches its own collector (and maybe a neighbour).
const base = { lat: 23.75, lng: 90.36 };
const pairs = [];
for (let i = 0; i < PAIRS; i++) {
  const at = { lat: base.lat + (i % 5) * 0.045, lng: base.lng + Math.floor(i / 5) * 0.045 };
  const hh = (await db.query(`INSERT INTO users (phone, role, name) VALUES ($1, 'HOUSEHOLD', $2) RETURNING id`, [`${PREFIX}${String(2 * i).padStart(5, '0')}`, `Load household ${i}`])).rows[0].id;
  const addr = (await db.query(
    `INSERT INTO addresses (user_id, label, line, area, location, is_default) VALUES ($1, 'Home', 'Load test', 'Load area', ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography, true) RETURNING id`,
    [hh, at.lat, at.lng],
  )).rows[0].id;
  const col = (await db.query(`INSERT INTO users (phone, role, name) VALUES ($1, 'COLLECTOR', $2) RETURNING id`, [`${PREFIX}${String(2 * i + 1).padStart(5, '0')}`, `Load collector ${i}`])).rows[0].id;
  await db.query(
    `INSERT INTO collector_profiles (user_id, nid_number, vehicle_type, has_scale, verification_status, is_online, last_location, last_seen_at)
     VALUES ($1, '1234567890', 'VAN', true, 'APPROVED', true, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography, now())`,
    [col, at.lat + 0.001, at.lng],
  );
  pairs.push({ i, hh: { id: hh, tok: token(hh, 'HOUSEHOLD') }, col: { id: col, tok: token(col, 'COLLECTOR') }, addr });
}

// 2. One socket per user, counting events.
const events = new Map();
const sockets = [];
async function connect(user) {
  const socket = io(API, { path: '/socket.io', transports: ['websocket'], auth: { token: user.tok }, forceNew: true });
  sockets.push(socket);
  events.set(user.id, []);
  socket.onAny((name) => events.get(user.id).push(name));
  await new Promise((resolve, reject) => {
    socket.once('ready', resolve);
    socket.once('unauthorized', () => reject(new Error('socket unauthorized')));
    setTimeout(() => reject(new Error('no socket ready')), 5000);
  });
}
await Promise.all(pairs.flatMap((p) => [connect(p.hh), connect(p.col)]));

// 3. A whole sale per pair, all at once.
const tomorrow = new Date(Date.now() + 30 * 3600e3).toISOString().slice(0, 10);
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
async function sale(p) {
  const pickup = await call('POST /pickups', 'POST', '/pickups', p.hh.tok, { addressId: p.addr, categoryCodes: ['IRON', 'NEWSPAPER'], weightBand: 'FROM_5_TO_15', slotDate: tomorrow, slot: 'MORNING' }, true);
  await call('accept', 'POST', `/pickups/${pickup.id}/accept`, p.col.tok, undefined, true);
  const code = (await call('GET /pickups/{id}', 'GET', `/pickups/${pickup.id}`, p.hh.tok)).pickupCode;
  await call('arrive', 'POST', `/pickups/${pickup.id}/arrive`, p.col.tok, { code });
  const slot = await call('photo slot', 'POST', `/pickups/${pickup.id}/photos`, p.col.tok, { kind: 'SCALE' });
  const up = await fetch(slot.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: JPEG });
  if (!up.ok) throw new Error(`upload ${up.status}`);
  await call('weights', 'POST', `/pickups/${pickup.id}/weights`, p.col.tok, { lines: [{ categoryCode: 'IRON', kg: 9.5 }, { categoryCode: 'NEWSPAPER', kg: 5 }], scalePhotoId: slot.photoId }, true);
  await call('confirm', 'POST', `/pickups/${pickup.id}/confirm`, p.hh.tok, { paymentMethod: 'CASH' }, true);
  await call('payment', 'POST', `/pickups/${pickup.id}/payment`, p.col.tok, { method: 'CASH' }, true);
  return pickup.id;
}
const t0 = performance.now();
const results = await Promise.allSettled(pairs.map(sale));
const seconds = (performance.now() - t0) / 1000;
await new Promise((r) => setTimeout(r, 500));

// 4. Report.
const failed = results.filter((r) => r.status === 'rejected');
const pct = (xs, q) => xs.sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))];
console.log(`\n${PAIRS - failed.length}/${PAIRS} sales completed in ${seconds.toFixed(1)} s (${(PAIRS / seconds).toFixed(1)} sales/s)`);
for (const f of failed.slice(0, 5)) console.log(`  failed: ${f.reason.message}`);
console.log('\nendpoint                 n     p50 ms   p95 ms   max ms');
for (const [label, xs] of timings) {
  console.log(`${label.padEnd(22)} ${String(xs.length).padStart(3)} ${pct(xs, 0.5).toFixed(0).padStart(8)} ${pct(xs, 0.95).toFixed(0).padStart(8)} ${Math.max(...xs).toFixed(0).padStart(8)}`);
}
const want = { hh: ['pickup.accepted', 'pickup.arrived', 'pickup.weighed', 'pickup.confirmed', 'pickup.paid'], col: ['request.created', 'pickup.accepted', 'pickup.arrived', 'pickup.weighed', 'pickup.confirmed', 'pickup.paid'] };
let missing = 0;
for (const p of pairs) {
  for (const [who, list] of [['hh', want.hh], ['col', want.col]]) {
    const got = events.get(p[who].id);
    for (const e of list) if (!got.includes(e)) missing++;
  }
}
console.log(`\nlive events: ${missing === 0 ? 'every expected event arrived' : `${missing} expected events missing`}`);

for (const s of sockets) s.disconnect();
if (CLEANUP) {
  const ids = (await db.query(`SELECT id FROM users WHERE phone LIKE $1`, [`${PREFIX}%`])).rows.map((r) => r.id);
  await db.query(`DELETE FROM pickups WHERE household_id = ANY($1::uuid[]) OR collector_id = ANY($1::uuid[])`, [ids]);
  await db.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
  console.log(`cleanup: removed ${ids.length} load-test users and their pickups`);
}
await db.end();
process.exit(failed.length || missing ? 1 : 0);
