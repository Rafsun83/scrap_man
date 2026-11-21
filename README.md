# BhangariWala (ভাঙ্গারিওয়ালা)

Households sell scrap from home; nearby collectors pick it up, weigh it in front of them at today's fixed rate, and pay on the spot.

This repository is the v1 monorepo. Milestones **M0** to **M6** are done: the backend with the full pickup engine, the household and collector screens in one mobile app, the admin panel, the public landing page, and pilot readiness (push and SMS behind interfaces, ops alerts, Dockerfiles, race and load tests). What remains is **M7 Launch**, which needs outside services and people; see [Milestones](#milestones).

## What's inside

| Path | What it is | Stack |
| --- | --- | --- |
| `apps/api` | Backend API under `/api/v1` | NestJS 12 (ESM), TypeORM 1, PostgreSQL + PostGIS, Redis |
| `apps/mobile` | One app for households and collectors | Expo SDK 58, React Native 0.88 |
| `apps/admin` | Admin panel for the operations team | React 19, Vite 8 |
| `apps/landing` | Public landing page: how it works, today's live rates, what we buy, safety, collector sign-up, FAQ (Bangla first, English toggle) | React 19, Vite 8 |
| `packages/shared` | Brand tokens, Bangla/English strings, enums, API types | TypeScript, generated from `docs/openapi.yaml` |
| `docs/openapi.yaml` | The API contract (OpenAPI 3.1) | |
| `docs/api.md` | API reference: every endpoint, its purpose, real sample requests and responses, live events | |
| `docs/product.md` | What v1 is: users, decisions, non-functional requirements | |
| `docs/design/` | The prototype: every screen (H1-H14, C1-C11, A1-A5) mapped to its source file, plus logos | |
| `docs/postman/` | Postman collection generated from the contract | |
| `milestones/` | One note per finished milestone: what was built, how it was checked, what is left | |
| `docker-compose.prod.yml` | Production stack: API, admin and landing page behind nginx, with the data services | Docker |

## First run

You need Node 22 or newer, Docker, and pnpm 12 (`corepack enable`, or `npm i -g pnpm@12.16.1`).

```bash
pnpm install
cp .env.example apps/api/.env
pnpm db:up          # PostgreSQL with PostGIS, Redis, and S3-compatible photo storage, in Docker
pnpm db:migrate     # creates the full schema
pnpm db:seed -- --sample-rates   # categories, the admin account, today's sample rates
pnpm dev            # API on :3000 and admin panel on :5173
```

Check it works:

- API: <http://localhost:3000/api/v1/health> returns `{"status":"ok", ...}`
- Admin panel: <http://localhost:5173> shows "The API, database and Redis are answering"
- Landing page: `pnpm dev:landing`, then <http://localhost:5174> shows today's rate board from the API

### Already ran M0?

Your Docker volume predates the test database. Create it once, add the new settings, then migrate and seed:

```bash
docker compose exec postgres createdb -U bw bhangariwala_test
cp .env.example apps/api/.env      # adds JWT_SECRET, OTP_DEV_CODE, ADMIN_PHONE and the test URLs
pnpm db:migrate && pnpm db:seed -- --sample-rates
```

### Already ran M1?

M2 adds photo storage (an S3-compatible SeaweedFS service on port 8333) and new settings. Start it, copy the new `S3_*` and `JOBS_ENABLED` lines from `.env.example` into `apps/api/.env` (the defaults already match), then migrate:

```bash
pnpm db:up && pnpm db:migrate
```

The API creates the photo bucket on start in development. Photo uploads go straight from the app to storage with a presigned link, so a phone must be able to reach `S3_ENDPOINT`.

### Signing in during development

No SMS provider is connected yet (M7). By default the API uses the console sender and prints each SMS in its log; an HTTP gateway adapter exists behind `SMS_PROVIDER=http` (see `.env.example`). With `OTP_DEV_CODE=123456` in `apps/api/.env`, every code is `123456`. Push notifications likewise go to a console sender until Firebase is set up. `ADMIN_PHONE` (default `+8801700000000`) is the admin account made by the seed. `OTP_DEV_CODE` is refused in production.

### Mobile app on your phone

1. Install **Expo Go** on the phone. Phone and computer must be on the same Wi-Fi.
2. `cp apps/mobile/.env.example apps/mobile/.env` and put your computer's Wi-Fi IP address in `EXPO_PUBLIC_API_URL`.
3. Optional: put a Google Maps key in `apps/mobile/.env.local` as `GOOGLE_MAPS_API_KEY` (keep it out of git). Without it the app shows distance and ETA instead of a map.
4. `pnpm dev:mobile`, then scan the QR code. The start screen shows whether it can reach the server.

Sign in with any new number to become a household. To try the collector side, sign up as a collector on another number and approve the application in the admin panel (Collector approvals).

## Everyday commands

| Command | Does |
| --- | --- |
| `pnpm dev` | API and admin panel with live reload |
| `pnpm dev:mobile` | Expo dev server for the app |
| `pnpm dev:landing` | Landing page on :5174 (proxies `/api` to :3000) |
| `pnpm test` | Unit tests in every package |
| `pnpm test:e2e` | API end-to-end tests (needs `pnpm db:up`); they use `bhangariwala_test` and Redis db 15, never your data |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | Checks across the monorepo |
| `pnpm gen:api` | Regenerate API types after editing `docs/openapi.yaml` |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm db:seed` | Load categories and the admin account (add `-- --sample-rates` for test prices) |
| `pnpm db:down` | Stop the Docker services |
| `pnpm smoke` / `pnpm smoke:down` | Build the production compose stack and run the smoke test through nginx / tear it down |
| `pnpm --filter @bw/api load -- --pairs 20 --api http://localhost:3000` | Parallel full sales against a local API (dev database only) |

Before calling a change done, run `pnpm turbo run lint typecheck test build`.

## Conventions

- The API follows `docs/openapi.yaml`. Change the contract first, run `pnpm gen:api`, then the code.
- The API is ESM: relative imports end in `.js`. Tests use Vitest.
- Money is `numeric(12,2)` taka and weight `numeric(8,1)` kg; the server computes every amount.
- The API speaks ASCII digits and English enum values. Bangla digits and words are for display only (`toBanglaDigits`, `formatTaka`, `formatKg` in `@bw/shared`).
- Dependencies are pinned to exact versions released at least two weeks before they were added.

## API

All paths start with `/api/v1`. Errors always come back as `{ code, message, details }`, and every response carries an `X-Request-Id` that matches the log lines. The full reference, with an endpoint index, sample requests and responses, and the Socket.IO live events, is [`docs/api.md`](docs/api.md); the contract is [`docs/openapi.yaml`](docs/openapi.yaml).

| Area | Endpoints | Who |
| --- | --- | --- |
| Health | `GET /health` | Anyone |
| Auth | `POST /auth/otp/request`, `/auth/otp/verify`, `/auth/refresh`, `/auth/logout` | Anyone |
| Catalog | `GET /categories`, `GET /rates/today`; `GET`, `PUT /admin/rates` | Anyone; admins publish rates |
| Profile and addresses | `GET`, `PATCH /me`; `/me/addresses` (list, add, edit, remove) | Signed in; addresses for households |
| Pickups | `POST /pickups`, `GET /pickups/{id}`, `GET /me/pickups`, `GET /me/summary`, and the state changes `cancel`, `accept`, `release`, `no-show`, `arrive`, `photos`, `weights`, `confirm`, `dispute`, `payment`, `rating` | Household, assigned collector, admin |
| Collector | `/collector/selfie`, `/collector/signup`, `/collector/profile`, `/collector/ledger`, `/collector/status`, `/collector/location`, `/collector/requests/nearby` | Collectors |
| Admin | `/admin/overview`, `/admin/alerts`, `/admin/map`, `/admin/pickups` (search, events, cancel), `/admin/disputes` (list, resolve), `/admin/collectors` (applications, decision), `/admin/users` (list, status) | Admins |
| Notifications and push | `GET /me/notifications`, `POST /me/notifications/read`, `PUT /me/devices`, `DELETE /me/devices/{token}` | Households and collectors |

## Design references

- Product spec: <https://claude.ai/artifact/3srj5eZptXZpuAAHwZNEkN>
- Technical blueprint (state machine, schema, API): <https://claude.ai/artifact/UgnJZmVSP3AHcj2ENumsex>
- Clickable prototype and logos: <https://claude.ai/artifact/TjyQBmde9ggomc5KSdXhQH>

## Milestones

- [x] **M0** Project setup
- [x] **M1** Backend core: OTP sign-in, users, addresses, categories, daily rates, schema migrations
- [x] **M2** Pickup engine: state machine, PostGIS matching, first accept wins, radius and expiry jobs, live events, photo uploads
- [x] **M3** Household app screens, summary, notifications feed, collector location and rating (phone walk-through pending)
- [x] **M4** Collector app screens, collector sign-up and approval, ledger, offline weigh draft (phone walk-through pending)
- [x] **M5** Admin panel: overview and map, rates, collectors, pickups and disputes, users (operations walk-through pending)
- [x] **M6** Pilot readiness without outside services: push and SMS behind interfaces, structured logs, ops alerts, Dockerfiles and production compose, race and load tests
- [ ] **M7** Launch, needs outside services or people:
  - Firebase project and an FCM push sender
  - a Bangladeshi SMS provider
  - an alert destination (Slack, email or pager)
  - hosting and domain: managed Postgres with PostGIS, Redis, S3/R2, TLS in front of nginx
  - EAS builds and signing, Google Play listing, background location (Play approval)
  - Google Maps key and a map tile provider decision
  - real-device walk-throughs of both apps and an operations walk-through of the admin panel
  - content: support number, help, terms, privacy policy, collector agreement

Each finished milestone has a note in [`milestones/`](milestones/README.md) with what was built, how it was checked, and what is left open.
