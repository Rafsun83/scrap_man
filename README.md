# BhangariWala (ভাঙ্গারিওয়ালা)

Households sell scrap from home; nearby collectors pick it up, weigh it in front of them at today's fixed rate, and pay on the spot.

This repository is the v1 monorepo. Milestones **M0** (project setup) and **M1** (backend core) are done: the full database schema, OTP sign-in, profiles, saved addresses, categories and daily rates.

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

There is no SMS gateway yet. With `OTP_DEV_CODE=123456` in `apps/api/.env`, every code is `123456`, and the API also prints each SMS in its log. `ADMIN_PHONE` (default `+8801700000000`) is the admin account made by the seed. `OTP_DEV_CODE` is refused in production.

### Mobile app on your phone

1. Install **Expo Go** on the phone. Phone and computer must be on the same Wi-Fi.
2. `cp apps/mobile/.env.example apps/mobile/.env` and put your computer's Wi-Fi IP address in `EXPO_PUBLIC_API_URL`.
3. `pnpm dev:mobile`, then scan the QR code. The start screen shows whether it can reach the server.

## Everyday commands

| Command | Does |
| --- | --- |
| `pnpm dev` | API and admin panel with live reload |
| `pnpm dev:mobile` | Expo dev server for the app |
| `pnpm test` | Unit tests in every package |
| `pnpm test:e2e` | API end-to-end tests (needs `pnpm db:up`); they use `bhangariwala_test` and Redis db 15, never your data |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | Checks across the monorepo |
| `pnpm gen:api` | Regenerate API types after editing `docs/openapi.yaml` |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm db:seed` | Load categories and the admin account (add `-- --sample-rates` for test prices) |
| `pnpm db:down` | Stop the Docker services |

## Conventions

- The API follows `docs/openapi.yaml`. Change the contract first, run `pnpm gen:api`, then the code.
- The API is ESM: relative imports end in `.js`. Tests use Vitest.
- Money is `numeric(12,2)` taka and weight `numeric(8,1)` kg; the server computes every amount.
- The API speaks ASCII digits and English enum values. Bangla digits and words are for display only (`toBanglaDigits`, `formatTaka`, `formatKg` in `@bw/shared`).
- Dependencies are pinned to exact versions released at least two weeks before they were added.

## API so far (M1)

All paths start with `/api/v1`. Errors always come back as `{ code, message, details }`.

| Endpoint | Who | Does |
| --- | --- | --- |
| `POST /auth/otp/request` | Anyone | Sends a 6-digit code; at most 3 per number and 10 per IP in 10 minutes |
| `POST /auth/otp/verify` | Anyone | Signs in or signs up; returns a 15-minute access token and a 30-day refresh token |
| `POST /auth/refresh` | Anyone | Swaps a refresh token for new tokens; each refresh token works once |
| `POST /auth/logout` | Anyone | Ends the session |
| `GET`, `PATCH /me` | Signed in | Profile: name and language |
| `GET`, `POST /me/addresses`, `PATCH`, `DELETE /me/addresses/{id}` | Households | Up to 10 saved addresses; one is the default |
| `GET /categories` | Anyone | The six categories in display order |
| `GET /rates/today` | Anyone | Latest rate per category and the change from the day before |
| `PUT /admin/rates` | Admins | Publish or correct rates for today or a later date |
| `GET /health` | Anyone | 200 when the database and Redis answer, 503 otherwise |

## Design references

- Product spec: <https://claude.ai/artifact/3srj5eZptXZpuAAHwZNEkN>
- Technical blueprint (state machine, schema, API): <https://claude.ai/artifact/UgnJZmVSP3AHcj2ENumsex>
- Clickable prototype and logos: <https://claude.ai/artifact/TjyQBmde9ggomc5KSdXhQH>

## Milestones

- [x] **M0** Project setup
- [x] **M1** Backend core: OTP sign-in, users, addresses, categories, daily rates, schema migrations
- [ ] **M2** Pickup engine: state machine, PostGIS matching, first accept wins, radius and expiry jobs, live events, photo uploads
- [ ] **M3** Household app screens
- [ ] **M4** Collector app screens
- [ ] **M5** Admin panel
- [ ] **M6** Pilot readiness: tests, push notifications, monitoring, deployment
