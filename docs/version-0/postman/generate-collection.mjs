// Regenerates bhangariwala.postman_collection.json: node docs/version-0/postman/generate-collection.mjs docs/version-0/postman/bhangariwala.postman_collection.json
// Add a req(...) here whenever an endpoint is added to the API.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const out = process.argv[2];

const bearer = (v) => ({ type: 'bearer', bearer: [{ key: 'token', value: `{{${v}}}`, type: 'string' }] });
const noauth = { type: 'noauth' };
const json = (o) => ({ mode: 'raw', raw: JSON.stringify(o, null, 2), options: { raw: { language: 'json' } } });

function test(lines) {
  return { listen: 'test', script: { type: 'text/javascript', exec: lines } };
}
function pre(lines) {
  return { listen: 'prerequest', script: { type: 'text/javascript', exec: lines } };
}
const expectStatus = (code) => [`pm.test('status ${code}', () => pm.response.to.have.status(${code}));`];
const save = (pairs) =>
  [
    'if (pm.response.code < 300 && pm.response.text()) {',
    '  const body = pm.response.json();',
    ...Object.entries(pairs).map(([v, expr]) => `  if (${expr} !== undefined && ${expr} !== null) pm.collectionVariables.set('${v}', ${expr});`),
    '}',
  ];

/** Builds a request item. path is relative to {{baseUrl}}, e.g. 'pickups/:pickupId/accept'. */
function req(name, method, path, { auth, body, query, status = 200, saveVars, idem, description, prerequest, headers = [] } = {}) {
  const segments = path.split('/');
  const variable = segments.filter((s) => s.startsWith(':')).map((s) => ({ key: s.slice(1), value: `{{${s.slice(1)}}}` }));
  const header = [...headers];
  if (idem) header.push({ key: 'Idempotency-Key', value: '{{$guid}}', description: 'Required. Repeat a call with the same key to get the first response back without doing the work twice.' });
  if (body) header.push({ key: 'Content-Type', value: 'application/json' });
  const events = [test([...expectStatus(status), ...(saveVars ? save(saveVars) : [])])];
  if (prerequest) events.unshift(pre(prerequest));
  return {
    name,
    event: events,
    request: {
      auth: auth ?? noauth,
      method,
      header,
      ...(body ? { body: json(body) } : {}),
      url: {
        raw: `{{baseUrl}}/${path}${query ? '?' + query.filter((q) => !q.disabled).map((q) => `${q.key}=${q.value}`).join('&') : ''}`,
        host: ['{{baseUrl}}'],
        path: segments,
        ...(query ? { query } : {}),
        ...(variable.length ? { variable } : {}),
      },
      ...(description ? { description } : {}),
    },
    response: [],
  };
}

/** PUT a file to a presigned storage URL (no API auth; the URL carries the signature). */
function upload(name, urlVar) {
  return {
    name,
    event: [test(expectStatus(200))],
    request: {
      auth: noauth,
      method: 'PUT',
      header: [{ key: 'Content-Type', value: 'image/jpeg' }],
      body: { mode: 'file', file: { src: '' } },
      url: { raw: `{{${urlVar}}}` },
      description:
        'Pick any JPEG in Body → binary before sending. The URL is the presigned link from the previous request (valid 15 minutes); send the same Content-Type it was issued for. The photo only counts once this upload succeeds.',
    },
    response: [],
  };
}

const H = bearer('householdToken');
const C = bearer('collectorToken');
const A = bearer('adminToken');

const otpRequest = (who, phoneVar) =>
  req(`Request OTP (${who})`, 'POST', 'auth/otp/request', { body: { phone: `{{${phoneVar}}}` }, status: 204 });
const otpVerify = (who, phoneVar, role, prefix) =>
  req(`Verify OTP → sign in (${who})`, 'POST', 'auth/otp/verify', {
    body: { phone: `{{${phoneVar}}}`, code: '{{otpCode}}', role },
    saveVars: { [`${prefix}Token`]: 'body.accessToken', [`${prefix}Refresh`]: 'body.refreshToken', [`${prefix}Id`]: 'body.user && body.user.id' },
    description:
      'New numbers sign up with the role sent; existing numbers keep their role (check user.role). In development every code is 123456. Saves the access and refresh tokens to collection variables.',
  });

const tomorrowScript = [
  "// Tomorrow's date in Dhaka (UTC+6), so the MORNING slot is always still open.",
  'const d = new Date(Date.now() + 6 * 3600 * 1000 + 24 * 3600 * 1000);',
  "pm.collectionVariables.set('slotDate', d.toISOString().slice(0, 10));",
];
const todayScript = [
  "// Today's date in Dhaka (UTC+6).",
  "pm.collectionVariables.set('today', new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10));",
];

const collection = {
  info: {
    name: 'BhangariWala API',
    _postman_id: 'b6f1d0a2-6c3e-4a51-9d5e-2f8a1c7e4b90',
    description: [
      'Every route implemented in `apps/api` up to M3 (all 36 routes, 49 requests). Contract: `docs/version-0/openapi.yaml`; prose reference: `docs/version-0/api.md`.',
      '',
      '## Before you start',
      '1. `pnpm db:up && pnpm db:migrate && pnpm db:seed -- --sample-rates`, then `pnpm dev` (API on :3000).',
      '2. Run the folders in order (or the whole collection with the Runner). Requests save ids, tokens and the pickup code into collection variables for the next steps.',
      '3. Every OTP in development is `123456`. The admin phone is `+8801700000000`.',
      '',
      '## Approving the collector (no endpoint until M4)',
      'Collector sign-up and admin approval arrive in M4. After **1. Auth → Verify OTP (collector)**, give the collector an approved profile with SQL (the same thing the e2e tests do):',
      '',
      '```',
      "docker compose exec postgres psql -U bw -d bhangariwala -c \"INSERT INTO collector_profiles (user_id, nid_number, vehicle_type, has_scale, verification_status) SELECT id, '1234567890', 'VAN', true, 'APPROVED' FROM users WHERE phone = '+8801812000002' ON CONFLICT (user_id) DO UPDATE SET verification_status = 'APPROVED';\"",
      '```',
      '',
      '## Notes',
      '- Requests marked with an `Idempotency-Key` header use `{{$guid}}`, so every send is a new action. To test a safe retry, replace it with a fixed value.',
      '- Photo uploads are two steps: ask for an upload slot, then PUT the file to `{{uploadUrl}}` / `{{scaleUploadUrl}}` (choose a JPEG under Body → binary).',
      '- The collector must be within the search radius of the address (1 km, 3 km after 5 minutes). The collection uses the same Mirpur 10 point for both.',
      '- Live events (Socket.IO at the API origin, path `/socket.io`, `auth.token` = access token) are not part of this collection; see `SocketEvents` in the contract.',
      '- To run it again from the start, change `householdPhone` and `collectorPhone` or reuse them (existing numbers keep their role).',
    ].join('\n'),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    ['baseUrl', 'http://localhost:3000/api/v1'],
    ['otpCode', '123456'],
    ['householdPhone', '+8801712000001'],
    ['collectorPhone', '+8801812000002'],
    ['adminPhone', '+8801700000000'],
    ['lat', '23.8069'],
    ['lng', '90.3687'],
    ['householdToken', ''],
    ['householdRefresh', ''],
    ['householdId', ''],
    ['collectorToken', ''],
    ['collectorRefresh', ''],
    ['collectorId', ''],
    ['adminToken', ''],
    ['adminRefresh', ''],
    ['adminId', ''],
    ['today', ''],
    ['slotDate', ''],
    ['addressId', ''],
    ['pickupId', ''],
    ['pickupCode', ''],
    ['uploadUrl', ''],
    ['itemsPhotoId', ''],
    ['scaleUploadUrl', ''],
    ['scalePhotoId', ''],
    ['disputeId', ''],
    ['trxId', ''],
  ].map(([key, value]) => ({ key, value, type: 'string' })),
  item: [
    {
      name: '0. Health',
      item: [req('Health check', 'GET', 'health', { description: 'Public. Reports whether the database and Redis answer.' })],
    },
    {
      name: '1. Auth',
      description: 'OTP sign-in for the three roles, token refresh and logout. All public.',
      item: [
        otpRequest('household', 'householdPhone'),
        otpVerify('household', 'householdPhone', 'HOUSEHOLD', 'household'),
        otpRequest('collector', 'collectorPhone'),
        otpVerify('collector', 'collectorPhone', 'COLLECTOR', 'collector'),
        otpRequest('admin', 'adminPhone'),
        otpVerify('admin', 'adminPhone', 'HOUSEHOLD', 'admin'),
        req('Refresh tokens (household)', 'POST', 'auth/refresh', {
          body: { refreshToken: '{{householdRefresh}}' },
          saveVars: { householdToken: 'body.accessToken', householdRefresh: 'body.refreshToken' },
          description: 'Each refresh token works once; the response carries a new pair, saved automatically.',
        }),
      ],
    },
    {
      name: '2. Catalog and rates',
      item: [
        req('List categories', 'GET', 'categories', { description: 'Public. Active categories in display order.' }),
        req("Today's rates", 'GET', 'rates/today', { description: 'Public. Latest published rate per category, with the change from yesterday.' }),
        req("Publish today's rates (admin)", 'PUT', 'admin/rates', {
          auth: A,
          status: 204,
          prerequest: todayScript,
          body: {
            effectiveDate: '{{today}}',
            rates: [
              { categoryCode: 'IRON', ratePerKg: 50 },
              { categoryCode: 'NEWSPAPER', ratePerKg: 30 },
              { categoryCode: 'PLASTIC', ratePerKg: 35 },
              { categoryCode: 'CARTON', ratePerKg: 18 },
              { categoryCode: 'ALUMINIUM', ratePerKg: 160 },
            ],
          },
          description: 'Admin only. Publishes (or corrects) the per-kg rates for today or a later date. ELECTRONICS is priced on inspection and takes no rate.',
        }),
      ],
    },
    {
      name: '3. Household profile',
      item: [
        req('Get me', 'GET', 'me', { auth: H }),
        req('Update name and language', 'PATCH', 'me', { auth: H, body: { name: 'Rasheda Begum', language: 'BN' } }),
        req('Add address', 'POST', 'me/addresses', {
          auth: H,
          status: 201,
          body: {
            label: 'Home',
            line: 'House 12, Road 4, Block C',
            area: 'Mirpur 10',
            city: 'Dhaka',
            location: { lat: 23.8069, lng: 90.3687 },
            note: 'Ask the caretaker downstairs',
            isDefault: true,
          },
          saveVars: { addressId: 'body.id' },
          description: 'Household only. Location is { lat, lng } inside Bangladesh.',
        }),
        req('List addresses', 'GET', 'me/addresses', { auth: H, description: 'Household only. Default first.' }),
        req('Edit address', 'PATCH', 'me/addresses/:addressId', { auth: H, body: { note: 'Blue gate, 3rd floor' } }),
      ],
    },
    {
      name: '4. Collector setup',
      description: 'Run the SQL in the collection description first, so this collector is APPROVED.',
      item: [
        req('Go online at a location', 'PUT', 'collector/status', {
          auth: C,
          status: 204,
          body: { online: true, location: { lat: 23.8069, lng: 90.3687 } },
          description: 'Approved collectors only (else 403 NOT_APPROVED).',
        }),
        req('Send location', 'PUT', 'collector/location', {
          auth: C,
          status: 204,
          body: { lat: 23.8069, lng: 90.3687 },
          description: 'Location ping. While a pickup is ACCEPTED it also goes to the household as collector.location.',
        }),
      ],
    },
    {
      name: '5. Pickup: happy path',
      description: 'Request → accept → arrive with the code → weigh with a scale photo → confirm → pay → rate.',
      item: [
        req('Create pickup request (household)', 'POST', 'pickups', {
          auth: H,
          status: 201,
          idem: true,
          prerequest: tomorrowScript,
          body: { addressId: '{{addressId}}', categoryCodes: ['IRON', 'NEWSPAPER'], weightBand: 'FROM_5_TO_15', slotDate: '{{slotDate}}', slot: 'MORNING', note: 'Ask the caretaker' },
          saveVars: { pickupId: 'body.id' },
          description: 'Household only. slotDate is today to 2 days ahead (Dhaka); the slot must not have ended. Sent to online approved collectors within 1 km.',
        }),
        req('Item photo: get upload slot (household)', 'POST', 'pickups/:pickupId/photos', {
          auth: H,
          status: 201,
          body: { kind: 'ITEMS', contentType: 'image/jpeg' },
          saveVars: { uploadUrl: 'body.uploadUrl', itemsPhotoId: 'body.photoId' },
        }),
        upload('Item photo: upload file', 'uploadUrl'),
        req('Nearby requests (collector)', 'GET', 'collector/requests/nearby', {
          auth: C,
          query: [
            { key: 'lat', value: '{{lat}}' },
            { key: 'lng', value: '{{lng}}' },
          ],
          description: 'Approved collectors only. Area, distance, items, slot and estimate; never the address or phone.',
        }),
        req('Accept (collector)', 'POST', 'pickups/:pickupId/accept', {
          auth: C,
          idem: true,
          description: 'First accept wins; others get 409 ALREADY_TAKEN. Copies today\'s rates and creates the 4-digit pickup code. The response now includes the address and household phone.',
        }),
        req('Get pickup (household) → saves pickup code', 'GET', 'pickups/:pickupId', {
          auth: H,
          saveVars: { pickupCode: 'body.pickupCode' },
          description: 'Owner, assigned collector or admin. pickupCode is returned to the household only, while ACCEPTED.',
        }),
        req('Get pickup (collector)', 'GET', 'pickups/:pickupId', { auth: C }),
        req('Arrive with the pickup code (collector)', 'POST', 'pickups/:pickupId/arrive', {
          auth: C,
          body: { code: '{{pickupCode}}' },
          description: 'Wrong code → 422 CODE_MISMATCH with details.attemptsLeft; the 5th wrong code locks the pickup (423 CODE_LOCKED) and alerts admins.',
        }),
        req('Scale photo: get upload slot (collector)', 'POST', 'pickups/:pickupId/photos', {
          auth: C,
          status: 201,
          body: { kind: 'SCALE', contentType: 'image/jpeg' },
          saveVars: { scaleUploadUrl: 'body.uploadUrl', scalePhotoId: 'body.photoId' },
        }),
        upload('Scale photo: upload file', 'scaleUploadUrl'),
        req('Submit weights (collector)', 'POST', 'pickups/:pickupId/weights', {
          auth: C,
          idem: true,
          body: {
            lines: [
              { categoryCode: 'IRON', kg: 8.5 },
              { categoryCode: 'NEWSPAPER', kg: 6 },
            ],
            scalePhotoId: '{{scalePhotoId}}',
          },
          description: 'kg to 0.1. Each line is one of the request\'s categories, at most once; ON_INSPECTION lines need quotedAmount. The server computes every amount. scalePhotoId must be an uploaded, unused SCALE photo (else 422 SCALE_PHOTO_REQUIRED).',
        }),
        req('Confirm weights, pick bKash (household)', 'POST', 'pickups/:pickupId/confirm', {
          auth: H,
          idem: true,
          body: { paymentMethod: 'BKASH', walletNumber: '{{householdPhone}}' },
          description: 'Household only, while WEIGHED. walletNumber is required for BKASH and NAGAD; use { "paymentMethod": "CASH" } for cash.',
        }),
        req('Record payment (collector)', 'POST', 'pickups/:pickupId/payment', {
          auth: C,
          idem: true,
          prerequest: ["// A fresh TrxID each run: a TrxID can be used once per method.", "pm.collectionVariables.set('trxId', 'TRX' + Date.now());"],
          body: { method: 'BKASH', trxId: '{{trxId}}' },
          description: 'Must match the confirmed method. trxId is required for BKASH and NAGAD (422 TRX_ID_REQUIRED) and can be used once (409 TRX_ID_REUSED). Status COMPLETED.',
        }),
        req('Rate the collector (household)', 'POST', 'pickups/:pickupId/rating', {
          auth: H,
          status: 204,
          body: { stars: 5, comment: 'Weighed in front of me, paid at once.' },
          description: 'Once per pickup, after COMPLETED. A second rating is 409 INVALID_STATE.',
        }),
        req('My pickups (household)', 'GET', 'me/pickups', {
          auth: H,
          query: [
            { key: 'status', value: 'COMPLETED', description: 'ACTIVE | COMPLETED | CANCELLED (CANCELLED includes EXPIRED). Omit for all.' },
            { key: 'limit', value: '20' },
            { key: 'cursor', value: '', disabled: true, description: 'nextCursor from the previous page' },
          ],
        }),
        req('My pickups (collector)', 'GET', 'me/pickups', { auth: C, query: [{ key: 'limit', value: '20' }] }),
        req('History totals (household)', 'GET', 'me/summary', {
          auth: H,
          description: 'Household only (M3, screen H11). Completed pickups, kg sold and taka earned.',
        }),
        req('Notifications (household)', 'GET', 'me/notifications', {
          auth: H,
          query: [
            { key: 'limit', value: '20' },
            { key: 'cursor', value: '', disabled: true, description: 'nextCursor from the previous page' },
          ],
          description:
            'Household only (M3, screen H13). Built from what happened: accepted, released, weighed, paid, expired, cancelled by an admin, dispute resolved, rates published. The household\'s own actions are not listed. unreadCount covers every page.',
        }),
        req('Mark all notifications read (household)', 'POST', 'me/notifications/read', {
          auth: H,
          status: 204,
          description: 'Household only. Everything up to now becomes read; unreadCount drops to 0.',
        }),
      ],
    },
    {
      name: '6. Disputes and admin',
      description: 'Run after folder 5. "Report not paid" opens a PAYMENT dispute on the completed pickup; the admin then resolves it.',
      item: [
        req('Report a problem: payment not received (household)', 'POST', 'pickups/:pickupId/dispute', {
          auth: H,
          status: 201,
          body: { type: 'PAYMENT', reason: 'No bKash message arrived.', photoIds: ['{{itemsPhotoId}}'] },
          saveVars: { disputeId: 'body.id' },
          description:
            'Types: WEIGHT (while WEIGHED; 1st is REWEIGH, later ADMIN_REVIEW, pickup goes DISPUTED), PAYMENT (while COMPLETED; payment REPORTED), BEHAVIOUR and OTHER (any time after accept). One open dispute per pickup. photoIds are ITEMS photos uploaded by the household.',
        }),
        req('List disputes (admin)', 'GET', 'admin/disputes', {
          auth: A,
          query: [{ key: 'status', value: 'ADMIN_REVIEW', description: 'REWEIGH | ADMIN_REVIEW | RESOLVED. Omit for all.' }],
        }),
        req('Resolve dispute (admin)', 'POST', 'admin/disputes/:disputeId/resolve', {
          auth: A,
          body: { outcome: 'PAYMENT_VERIFIED', note: 'TrxID checked with bKash statement.' },
          description:
            'Outcomes per type: WEIGHT → ACCEPT_WEIGHTS, TEAM_REWEIGH, CANCEL; PAYMENT → PAYMENT_VERIFIED, PAY_AGAIN, SUSPEND_COLLECTOR; BEHAVIOUR / OTHER → NO_ACTION, SUSPEND_COLLECTOR, CANCEL. REWEIGHED is set by the system.',
        }),
      ],
    },
    {
      name: '7. Other actions',
      description: 'Cancel, release and admin cancel need a fresh pickup: each folder starts by creating one.',
      item: [
        {
          name: 'Household cancels',
          item: [
            req('Create pickup request (household)', 'POST', 'pickups', {
              auth: H,
              status: 201,
              idem: true,
              prerequest: tomorrowScript,
              body: { addressId: '{{addressId}}', categoryCodes: ['PLASTIC'], weightBand: 'UNDER_5', slotDate: '{{slotDate}}', slot: 'AFTERNOON' },
              saveVars: { pickupId: 'body.id' },
            }),
            req('Cancel pickup (household)', 'POST', 'pickups/:pickupId/cancel', {
              auth: H,
              body: { reason: 'Sold it to a neighbour.' },
              description: 'Household owner only, while REQUESTED or ACCEPTED.',
            }),
          ],
        },
        {
          name: 'Collector releases',
          item: [
            req('Create pickup request (household)', 'POST', 'pickups', {
              auth: H,
              status: 201,
              idem: true,
              prerequest: tomorrowScript,
              body: { addressId: '{{addressId}}', categoryCodes: ['CARTON', 'ELECTRONICS'], weightBand: 'UNSURE', slotDate: '{{slotDate}}', slot: 'MIDDAY' },
              saveVars: { pickupId: 'body.id' },
            }),
            req('Accept (collector)', 'POST', 'pickups/:pickupId/accept', { auth: C, idem: true }),
            req('Release (collector)', 'POST', 'pickups/:pickupId/release', {
              auth: C,
              status: 204,
              body: { reason: 'Van broke down.' },
              description: 'Assigned collector only, while ACCEPTED. Back to REQUESTED at 1 km; clears collector, code and copied rates.',
            }),
          ],
        },
        {
          name: 'Admin cancels',
          item: [
            req('Create pickup request (household)', 'POST', 'pickups', {
              auth: H,
              status: 201,
              idem: true,
              prerequest: tomorrowScript,
              body: { addressId: '{{addressId}}', categoryCodes: ['ALUMINIUM'], weightBand: 'OVER_15', slotDate: '{{slotDate}}', slot: 'MORNING' },
              saveVars: { pickupId: 'body.id' },
            }),
            req('Cancel pickup (admin)', 'POST', 'admin/pickups/:pickupId/cancel', {
              auth: A,
              body: { reason: 'Duplicate request reported by the household.' },
              description: 'Admin only. Any active status; reason required.',
            }),
          ],
        },
        req('Delete address (household)', 'DELETE', 'me/addresses/:addressId', {
          auth: H,
          status: 204,
          description: 'Run last: the other requests use this address.',
        }),
        req('Log out (household)', 'POST', 'auth/logout', {
          body: { refreshToken: '{{householdRefresh}}' },
          status: 204,
          description: 'Revokes the refresh token. The access token stays valid until it expires.',
        }),
      ],
    },
  ],
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(collection, null, 2) + '\n');

// Count requests (excluding the two raw uploads) and list distinct routes.
const routes = new Set();
let n = 0;
const walk = (items) =>
  items.forEach((i) => {
    if (i.item) return walk(i.item);
    n++;
    if (i.request.url.path) routes.add(`${i.request.method} /${i.request.url.path.join('/')}`);
  });
walk(collection.item);
console.log(`${n} requests, ${routes.size} distinct API routes`);
console.log([...routes].sort().join('\n'));
