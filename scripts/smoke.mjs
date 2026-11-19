// Smoke test of the production stack (docker-compose.prod.yml), through the admin panel's nginx like a browser.
// Usage: node scripts/smoke.mjs [baseUrl]   (default http://localhost:8180, from docker/smoke.env)
// Signs in with the console SMS provider, reading the code from the API container's log.
import { execSync } from 'node:child_process';

const base = process.argv[2] ?? 'http://localhost:8180';
const compose = 'docker compose -p bw-smoke -f docker-compose.prod.yml --env-file docker/smoke.env';
const phone = '+8801700000000';
const fail = (msg) => {
  console.error(`SMOKE FAILED: ${msg}`);
  process.exit(1);
};
const check = (ok, msg) => (ok ? console.log(`ok  ${msg}`) : fail(msg));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      // not up yet
    }
    await sleep(2000);
  }
  fail(`${url} did not come up`);
}

await waitFor(`${base}/healthz`);
const health = await (await waitFor(`${base}/api/v1/health`)).json();
check(health.status === 'ok' && health.checks.database === 'up' && health.checks.redis === 'up', 'API healthy through nginx (database, redis)');

const page = await (await fetch(`${base}/pickups`)).text();
check(page.includes('<title>BhangariWala Admin</title>'), 'admin panel served, deep link falls back to index.html');

const categories = await (await fetch(`${base}/api/v1/categories`)).json();
check(Array.isArray(categories) && categories.length === 6, 'migrations and seed ran: 6 categories');

const requested = await fetch(`${base}/api/v1/auth/otp/request`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'smoke-otp-1' },
  body: JSON.stringify({ phone }),
});
check(requested.status === 204 && requested.headers.get('x-request-id') === 'smoke-otp-1', 'OTP requested; X-Request-Id passes through nginx');

let code = null;
for (let i = 0; i < 10 && !code; i++) {
  const logs = execSync(`${compose} logs api`, { encoding: 'utf8' });
  const lines = logs.split('\n').filter((l) => l.includes(phone) && /\b\d{6}\b/.test(l));
  code = lines.length ? lines.at(-1).match(/\b(\d{6})\b/g).at(-1) : null;
  if (!code) await sleep(1000);
}
check(code, 'OTP found in the API log (console SMS)');
const jsonLog = execSync(`${compose} logs api`, { encoding: 'utf8' }).includes('"requestId":"smoke-otp-1"');
check(jsonLog, 'JSON log lines carry the request id');

const session = await (
  await fetch(`${base}/api/v1/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code, role: 'HOUSEHOLD' }),
  })
).json();
check(session.user?.role === 'ADMIN', 'seeded admin signs in');

const auth = { Authorization: `Bearer ${session.accessToken}` };
const overview = await fetch(`${base}/api/v1/admin/overview`, { headers: auth });
check(overview.ok && (await overview.json()).counts, 'admin overview answers');
const alerts = await fetch(`${base}/api/v1/admin/alerts`, { headers: auth });
check(alerts.ok && Array.isArray(await alerts.json()), 'ops alerts answer');

const socket = await fetch(`${base}/socket.io/?EIO=4&transport=polling`);
check(socket.ok && (await socket.text()).includes('sid'), 'Socket.IO reachable through nginx');
console.log('SMOKE PASSED');
