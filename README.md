# BhangariWala (ভাঙ্গারিওয়ালা)

Households sell scrap from home; nearby collectors pick it up, weigh it in front of them at today's fixed rate, and pay on the spot.

This repository is the v1 monorepo. Milestone **M0** (project setup) is done: every app starts, talks to the API, and the API talks to PostgreSQL and Redis.

## What's inside

| Path | What it is | Stack |
| --- | --- | --- |
| `apps/api` | Backend API under `/api/v1` | NestJS 12 (ESM), TypeORM 1, PostgreSQL + PostGIS, Redis |
| `apps/mobile` | One app for households and collectors | Expo SDK 58, React Native 0.88 |
| `apps/admin` | Admin panel for the operations team | React 19, Vite 8 |
| `packages/shared` | Brand tokens, Bangla/English strings, enums, API types | TypeScript, generated from `docs/openapi.yaml` |
| `docs/openapi.yaml` | The API contract (OpenAPI 3.1) | |

## First run

You need Node 22 or newer, Docker, and pnpm 12 (`corepack enable`, or `npm i -g pnpm@12.16.1`).

```bash
pnpm install
cp .env.example apps/api/.env
pnpm db:up          # PostgreSQL with PostGIS, and Redis, in Docker
pnpm db:migrate     # turns on PostGIS and pgcrypto
pnpm dev            # API on :3000 and admin panel on :5173
```

Check it works:

- API: <http://localhost:3000/api/v1/health> returns `{"status":"ok", ...}`
- Admin panel: <http://localhost:5173> shows "The API, database and Redis are answering"

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
| `pnpm test:e2e` | API end-to-end tests (needs `pnpm db:up`) |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | Checks across the monorepo |
| `pnpm gen:api` | Regenerate API types after editing `docs/openapi.yaml` |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm db:down` | Stop the Docker services |

## Conventions

- The API follows `docs/openapi.yaml`. Change the contract first, run `pnpm gen:api`, then the code.
- The API is ESM: relative imports end in `.js`. Tests use Vitest.
- Money is `numeric(12,2)` taka and weight `numeric(8,1)` kg; the server computes every amount.
- The API speaks ASCII digits and English enum values. Bangla digits and words are for display only (`toBanglaDigits`, `formatTaka`, `formatKg` in `@bw/shared`).
- Dependencies are pinned to exact versions released at least two weeks before they were added.

## Design references

- Product spec: <https://claude.ai/artifact/3srj5eZptXZpuAAHwZNEkN>
- Technical blueprint (state machine, schema, API): <https://claude.ai/artifact/UgnJZmVSP3AHcj2ENumsex>
- Clickable prototype and logos: <https://claude.ai/artifact/TjyQBmde9ggomc5KSdXhQH>

## Milestones

- [x] **M0** Project setup
- [ ] **M1** Backend core: OTP sign-in, users, addresses, categories, daily rates, schema migrations
- [ ] **M2** Pickup engine: state machine, PostGIS matching, first accept wins, radius and expiry jobs, live events, photo uploads
- [ ] **M3** Household app screens
- [ ] **M4** Collector app screens
- [ ] **M5** Admin panel
- [ ] **M6** Pilot readiness: tests, push notifications, monitoring, deployment
