# M6 Pilot readiness (no outside services)

**Finished:** 2026-11-17 · **Status:** everything that can be built without a third-party account is built and checked. Each outside service (Firebase, an SMS provider, an alert destination, hosting) now plugs into an interface that already exists. Those hookups are M7.

This milestone adds:
- **Collectors** get their own notification feed and can report a household not home.
- **Both apps** register for push notifications once Firebase exists.
- **The API** sends push for every pickup event and has an HTTP SMS gateway adapter.
- **Logs** are JSON with a request id on every line.
- **Operations** gets live alerts for stuck pickups, wrong-code spikes, payment reports and no-shows.
- **The stack** builds as production Docker images and passes a smoke test through nginx in CI.
- **Race and load** behaviour is measured.
- **The mobile app and the admin panel** now share one API client and one Dhaka date module.

## Checklist

### Contract (`docs/version-0/openapi.yaml` first, then `pnpm gen:api`)
- [x] `/me/notifications` and `/me/notifications/read` are open to collectors:
  - new types for collectors: `APPLICATION_APPROVED/REJECTED`, `PICKUP_CONFIRMED`, `PICKUP_DISPUTED`, `PAYMENT_REPORTED`, `RATED`
  - new type for households: `PICKUP_NO_SHOW`
  - new data fields: `householdName`, `disputeStatus`, `note`, `stars`
- [x] `POST /pickups/{id}/no-show`:
  - ACCEPTED -> CANCELLED by the collector
  - errors: 409 before the slot starts; 422 when more than 200 m away or the location is stale
  - added to the state-machine table in CLAUDE.md
- [x] `PUT /me/devices` and `DELETE /me/devices/{token}` (`DeviceInput`).
- [x] `GET /admin/alerts` (`OpsAlert`) and the socket event `ops.alert`.
- [x] `NO_SHOW` attention item; `AdminUserRow.household.noShows30d`.
- [x] `X-Request-Id` described in the info section.
- [x] `@bw/shared`: `OPS_ALERTS`, `NO_SHOW_MAX_DISTANCE_M`, `DEVICE_PLATFORMS`; push strings; the collector and no-show strings for mobile and admin.

### API (`apps/api`, to the backend standard)
- [x] **Migration** `1763539200000-PilotReadiness`: `push_devices` and a partial index for no-shows. Tested up, down and up.
- [x] **No-show** (pickups module):
  - the slot-start check, distance and freshness checks, a `status_events` row with `reason: NO_SHOW`
  - the new transition is pinned by the state-machine unit test
- [x] **Collector feed** (notifications module): a second read-only query over `collector_profiles`, `status_events`, `disputes` and `ratings`. Rates count only after approval. The collector's own actions aren't listed.
- [x] **New `push` module:**
  - device tokens; a token moves to whoever registers it
  - `PushService.notify` is best effort and fire-and-forget; tokens the provider rejects are removed
  - the text is written on the server in the user's language, using the `@bw/shared` strings
  - `PickupEventsService` sends a push for every pickup event to whoever it's news for (never the actor); also new-request pushes to nearby collectors, payment reports, resolved disputes and the application decision
  - `ConsolePushSender` until FCM arrives
- [x] **SMS:** `HttpSmsService` (JSON POST, bearer key, timeout, one retry on network errors or 5xx, no retry on 4xx, masked numbers in logs). `SMS_PROVIDER` defaults to `http` in production and fails fast without a URL and key.
- [x] **Logs:**
  - `AppLogger` (Nest JSON logger) adds `requestId` and `userId` from an AsyncLocalStorage context
  - middleware sets and echoes `X-Request-Id` and writes one access line per request
  - JSON when `NODE_ENV=production` or `LOG_FORMAT=json`
- [x] **New `ops` module:**
  - alert checks over the pickups tables, plus wrong-code counts kept in one-minute Redis buckets by the auth module
  - `GET /admin/alerts`
  - a job every minute announces each new alert once, as an `alert` log line and `ops.alert` to admins
- [x] **Admin read model:** the `NO_SHOW` attention item and each household's no-show count.
- [x] `S3_CREATE_BUCKET`, so a self-hosted stack gets its bucket.
- [x] `src/database/migrate.ts` for the container start.

### Apps
- [x] **Collector app:**
  - a bell with an unread badge on C1, opening `/inbox` (a shared `NotificationsScreen`; `/notifications` stays the household path)
  - a "গ্রাহক বাসায় নেই" option in C3's sheet: before the slot starts it shows when reporting opens; afterwards a note and a confirm button, with a fresh location ping first
- [x] **Notification text** moved to `src/notifications/` and became role-aware: collector items open `/job/{id}`, households see the no-show sentence.
- [x] **Push in both apps:**
  - `expo-notifications` 58.1.9 (the version Expo chose)
  - it registers only when `GOOGLE_SERVICES_JSON` is set at build time (`extra.pushEnabled`), loaded lazily like the maps module
  - it registers the token, shows banners, opens the right screen from a tap (`pushRoute`), and removes the token on sign-out
- [x] **Admin panel:**
  - an alerts panel on A1 (severity, sentence, View), refreshed by `ops.alert`
  - the `NO_SHOW` attention sentence
  - a no-shows column on A5
- [x] **Shared code:**
  - `createApiClient`/`ApiError` and the Dhaka calendar (`dhakaParts`, `formatDhakaDate/LongDate/Time`, month and weekday names) now live in `@bw/shared`
  - mobile and admin keep thin wrappers, so their import sites didn't change
  - the client tests moved to shared
  - the old `ApiError` type alias for the error body is now `ApiErrorBody`

### Deployment files (tested locally; nothing deployed)
- [x] **`docker/api/Dockerfile`:**
  - multi-stage, with a filtered production install
  - runs migrations, then the idempotent seed, then the API
  - health check, non-root user
- [x] **`docker/admin/Dockerfile` and `nginx.conf`:**
  - Vite build served by nginx
  - `/api` and `/socket.io` (WebSocket upgrade) forwarded to the API, with `X-Request-Id` passed through
  - deep links fall back to `index.html`
- [x] **`docker-compose.prod.yml`:** API, admin, PostGIS, Redis, SeaweedFS. Settings come from `.env.prod`; a production section was added to `.env.example`.
- [x] **Smoke test** (`docker/smoke.env`, `scripts/smoke.mjs`, `pnpm smoke`): health, admin page and deep link, migrations and seed, OTP sign-in (code read from the API log), request id through nginx and in the JSON logs, admin overview, alerts, Socket.IO.
- [x] **CI:** a new `docker-smoke` job builds and smoke-tests the images on every push and PR.

### Race and load
- [x] **`race.e2e-spec`:**
  - 20 collectors accept at once: exactly 1 wins, 19 get `ALREADY_TAKEN`, and one accept is recorded
  - the same TrxID on two payments at once: one succeeds
  - one Idempotency-Key sent five times at once: one pickup
- [x] **`apps/api/scripts/load.mjs`** (`pnpm --filter @bw/api load`):
  - dev database only, refuses otherwise
  - its users have their own phone prefix, and `--cleanup` removes them
  - runs N complete sales in parallel with a Socket.IO client per user

## Verification

| Check | Result |
| --- | --- |
| `pnpm turbo run lint typecheck test build` | 13/13 tasks; lint 0 warnings |
| `pnpm test:e2e` | 17 files, **140 tests** pass (19 new: collector feed and no-show 5, push 5, ops and request ids 6, races 3) |
| API unit | 35 pass (SMS adapter and env added; the state-machine table includes the no-show) |
| Shared, admin, mobile | 17, 28 and 91 pass |
| Migration | up, down and up on the dev database; all 7 migrations applied from scratch inside the production container |
| **Production stack** | `docker compose -f docker-compose.prod.yml` builds both images (about 75 s). Both containers are healthy, and **all 10 smoke checks pass** through nginx |
| **Load, 20 pairs** | 20/20 complete sales in 1.8 s; every expected live event arrived (220) |
| **Load, 50 pairs** | 50/50 in 3.1 s (16 sales/s); per-call p95 between 246 ms (photo slot) and 576 ms (create); every expected event arrived (550). One local API process, dev database on the same machine |
| Live samples | A scripted run against a local API recorded the no-show (and its 409 before the slot), both feeds, alerts and devices for `docs/version-0/api.md`. The push log shows the Bangla accept and no-show messages going to the household's phone |
| `npx expo export --platform android` | Bundles (3.3 MB), with and without push enabled |
| **On a phone** | **Not run** (no Android device or emulator here); a real push also needs Firebase (M7) |

## Decisions taken in M6

These were agreed before building:
- **No-show:** within 200 m, after the slot starts, cancels straight away and alerts operations.
- **Alert thresholds:** as listed under the ops module (`OPS_ALERTS`).
- **Production admin:** served by nginx, which also forwards to the API.
- **`expo-notifications`:** the only new app dependency.

Taken while building:
- **Push text is written on the server,** in each user's saved language, so a push shows the right words even when the app is closed. The in-app feed still writes its own text.
- **The person who acted is never pushed.** A household's own cancel goes to the collector only, and the collector's own no-show to the household only.
- **Load-test users are created in the database with signed tokens,** instead of weakening the per-IP OTP limit.
- **SMS in production must be chosen explicitly.** Without an SMS URL and key, production refuses to start unless `SMS_PROVIDER=console` is set (used only by the local smoke stack).
- **One time format:** "4:05 pm" in English everywhere; the admin panel used "PM" before and now matches the apps.
- **`ApiErrorBody` rename** in `@bw/shared`, because the old type alias hid the new `ApiError` class.

## Open items (all in M7)

- **Firebase:**
  - a Firebase project and `google-services.json` (set `GOOGLE_SERVICES_JSON`)
  - an FCM sender behind `PUSH_SENDER`, with service-account credentials on the server
- **SMS:** choose a Bangladeshi SMS provider. If it doesn't accept the JSON POST format, add an adapter behind `SMS_SENDER`.
- **Alerts:** an alert destination (Slack, email or pager) that reads the `alert` log lines or plugs into `OpsAlertsService`.
- **Hosting and domain:** managed Postgres with PostGIS, Redis and S3/R2 replace the compose data services; TLS in front of nginx.
- **Mobile release:** EAS builds and signing, the Play listing, background location (Play approval).
- **Walk-throughs:** real-device sessions for both apps and an operations session for the panel; then content and the map-tile decision.
