# M0: Project setup

Status: **done**. Confirmed working on Rafsun's machine.

The monorepo, its tools, and the connections between the apps, the API, PostgreSQL and Redis. No product features yet.

## Monorepo
- [x] Turborepo 2.11.10 with pnpm 12.16.1 workspaces (`apps/*`, `packages/*`)
- [x] Flat `node_modules` (`node-linker=hoisted`) so React Native's Metro bundler works
- [x] Turbo tasks: `build`, `typecheck`, `test`, `lint`, `dev`; shared package builds first
- [x] Root scripts: `dev`, `dev:mobile`, `build`, `test`, `test:e2e`, `lint`, `typecheck`, `gen:api`, `db:up`, `db:down`, `db:migrate`
- [x] Every dependency pinned to an exact version released at least 14 days earlier
- [x] `.gitignore`, `.editorconfig`, `.prettierrc`, `.env.example`

## API (`apps/api`): NestJS 12, ESM
- [x] Settings checked at startup; a missing value stops the server with a clear message
- [x] PostgreSQL connection through TypeORM 1 (no auto-sync; migrations only)
- [x] Redis connection (ioredis 5, the line TypeORM expects)
- [x] `GET /api/v1/health`: 200 when the database and Redis answer, 503 naming the one that doesn't
- [x] First migration: turns on PostGIS and pgcrypto
- [x] Migration commands built in (`migration:run`, `migration:revert`)
- [x] Unit tests for settings and the health check; end-to-end health test

## Admin panel (`apps/admin`): React 19, Vite 8
- [x] Brand sidebar with the five sections: Live pickups, Daily rates, Collector approvals, Disputes, Users
- [x] API connection panel that shows whether the API, database and Redis are up
- [x] Dev server passes `/api` calls to the API on port 3000
- [x] Anek Bangla and Hind Siliguri fonts; favicon from the app icon

## Mobile app (`apps/mobile`): Expo SDK 58, React Native 0.88
- [x] Yellow Bangla/English start screen with the logo, app name and tagline
- [x] Server check: "সার্ভারের সাথে সংযোগ আছে" or "সংযোগ হচ্ছে না", tap to retry
- [x] App name ভাঙ্গারিওয়ালা; Android package and iOS bundle `com.bhangariwala.app`
- [x] App icon (L3), Android adaptive icon layers, splash image (L5), favicon
- [x] `.env.example` for the API address the phone should call

## Shared package (`packages/shared`)
- [x] Brand colours, fonts, radii, minimum touch size
- [x] Enums as lists: pickup statuses, slots, weight bands, payment methods, roles
- [x] Matching rules (1 km, 3 km after 5 minutes) and the 2 kg minimum
- [x] Bangla and English strings; `toBanglaDigits`, `formatTaka`, `formatKg`, `t()`
- [x] API types generated from `docs/version-0/openapi.yaml` (`pnpm gen:api`)
- [x] Unit tests for the formatting helpers

## Local services and CI
- [x] Docker Compose: PostgreSQL 17 with PostGIS 3.5, and Redis 7.4, with health checks
- [x] GitHub Actions: lint, typecheck, test and build; API end-to-end tests with Postgres and Redis
- [x] README: first run, commands, conventions, milestones

## Checked before handing over
- [x] Frozen install works from the lockfile
- [x] Lint, typecheck, test and build pass for all packages (11 of 11 tasks)
- [x] Migration ran on a real database; PostGIS active
- [x] Health check: 200, then 503 with Redis stopped, then 200 again
- [x] Admin dev server reaches the API through its proxy
- [x] Expo bundled the Android app with the shared package (600 modules)

## Checked on your machine
- [x] `pnpm install`, `pnpm db:up`, `pnpm db:migrate`, `pnpm dev`
- [x] http://localhost:3000/api/v1/health shows `"status":"ok"`
- [x] http://localhost:5173 shows the API as answering
- [x] Phone shows the connected message in Expo Go