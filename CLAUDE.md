# BhangariWala (ভাঙ্গারিওয়ালা)

Households in Dhaka sell scrap (iron, old newspaper, plastic, carton, aluminium, electronics) from home. A nearby collector accepts the request, comes to the door, weighs the items in front of the household at today's fixed rate, and pays by cash, bKash or Nagad. One mobile app serves households and collectors; operations staff use a web admin panel.

## Repo

- `apps/api`: NestJS 12 (ESM only), TypeORM 1, PostgreSQL 17 + PostGIS, Redis (ioredis 5). Prefix `/api/v1`.
- `apps/mobile`: Expo SDK 58, React Native 0.88. One app, two roles.
- `apps/admin`: React 19 + Vite 8. English UI with a Bangla toggle.
- `packages/shared` (`@bw/shared`): brand tokens, Bangla/English strings, enums, matching constants, and API types generated from `docs/openapi.yaml`.
- `docs/openapi.yaml`: the API contract (OpenAPI 3.1). Source of truth for endpoints, shapes and error codes.

## Commands

- `pnpm dev` (API :3000 + admin :5173), `pnpm dev:mobile`
- `pnpm turbo run lint typecheck test build`: run before calling any task done
- `pnpm test:e2e`: API end-to-end tests against `bhangariwala_test` and Redis db 15 (the config refuses any database not ending in `_test`)
- `pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed -- --sample-rates`
- `pnpm gen:api`: regenerate `packages/shared/src/generated/api.ts` after editing the contract

Development sign-in: every OTP is `123456` (`OTP_DEV_CODE`); admin phone `+8801700000000`.

## Conventions

- Contract first: change `docs/openapi.yaml`, run `pnpm gen:api`, then code.
- API is ESM: relative imports end in `.js`; use `import.meta.dirname`. Tests use Vitest (`vi.fn()`).
- Validation: Zod schemas with `new ZodPipe(schema)` on `@Body`/`@Param`.
- Errors: throw `AppError` (`src/common/errors.ts`); the global filter returns `{ code, message, details }`. Use contract error codes only. Messages say what happened and what to do.
- Auth: a global guard checks every route. Mark open routes `@Public()`; limit roles with `@Roles('ADMIN')`; read the user with `@CurrentUser()`.
- Database: hand-written SQL migrations in `apps/api/src/database/migrations` (never `synchronize`). Entities map snake_case columns with `name:`. Locations are `geography(Point, 4326)`, read and written as GeoJSON `[lng, lat]`.
- Money `numeric(12,2)` taka, weight `numeric(8,1)` kg. The server computes every amount; never trust one sent by an app.
- The API uses ASCII digits and English enum values. Bangla digits and words are display only (`toBanglaDigits`, `formatTaka`, `formatKg`).
- Every e2e test file uses `createTestApp()` and `resetData()` from `apps/api/test/helpers.ts`; SMS goes to `FakeSms`.
- Dependencies: exact versions, released at least 14 days before they are added.
- Mobile UI: Bangla first, 48 px touch targets, icon plus text on every action. Brand colours in `@bw/shared` (`colors`).

## Product rules (from the spec)

- Roles: HOUSEHOLD, COLLECTOR, ADMIN. A phone number keeps the role it signed up with. Collectors give a selfie and NID number; an admin approves them. NID card verification comes later.
- Launch area: all of Dhaka. Revenue model: on hold; v1 charges no commission.
- Rates: admins publish a per-kg rate per category each day. Electronics are priced on inspection (no daily rate).
- Minimum request: 2 kg estimated, unless it includes electronics.
- Matching: a new request goes to online, approved collectors within 1 km; if nobody accepts in 5 minutes, the radius widens to 3 km. A request nobody accepts expires at the end of its booked slot (MORNING 9-12, MIDDAY 12-3, AFTERNOON 3-6, Dhaka time).
- First accept wins: one atomic update where status is still REQUESTED; others get ALREADY_TAKEN.
- Collectors see area and distance only; exact address and household phone unlock on accept.
- Rates are copied onto the pickup (`pickup_items.rate_snapshot`) at accept.
- Pickup code: 4 digits, created at accept, stored hashed, shown only to the household. The collector must enter it to reach ARRIVED; 5 wrong tries lock the pickup and alert an admin.
- Weighing: kg per item to 0.1 kg; a scale photo is required. Weigh rounds are versioned in `weigh_lines`.
- The household must approve the weights; nothing is auto-confirmed. First rejection: collector re-weighs. Second rejection: dispute goes to admin review.
- Payment: cash, or bKash/Nagad sent by the collector with a TrxID. A TrxID can be used once (`UNIQUE (method, trx_id)`). A "not received" report opens a PAYMENT dispute without changing the pickup status.
- Every status change writes a row to `status_events`.

## Pickup state machine

| From -> To | Who | Trigger |
| --- | --- | --- |
| REQUESTED -> ACCEPTED | Collector | `POST /pickups/{id}/accept` |
| REQUESTED -> REQUESTED | System | 5 min after the request: radius 1000 -> 3000 m |
| REQUESTED -> EXPIRED | System | end of the booked slot |
| REQUESTED or ACCEPTED -> CANCELLED | Household or admin | `POST /pickups/{id}/cancel` (admin: any active status) |
| ACCEPTED -> REQUESTED | Collector | `POST /pickups/{id}/release`: clears collector, code and locked rates |
| ACCEPTED -> ARRIVED | Collector | `POST /pickups/{id}/arrive` with the code |
| ARRIVED -> WEIGHED | Collector | `POST /pickups/{id}/weights` with lines and a scale photo |
| WEIGHED -> CONFIRMED | Household | `POST /pickups/{id}/confirm` with a payment method |
| WEIGHED -> DISPUTED | Household | `POST /pickups/{id}/dispute` type WEIGHT (1st: REWEIGH, 2nd: ADMIN_REVIEW) |
| DISPUTED -> WEIGHED | Collector or admin | re-weigh (version + 1), or admin accepts the weights |
| DISPUTED -> CANCELLED | Admin | `POST /admin/disputes/{id}/resolve` outcome CANCEL |
| CONFIRMED -> COMPLETED | Collector | `POST /pickups/{id}/payment` (TrxID required for BKASH and NAGAD) |

Any other change is refused with INVALID_STATE. Live events (Socket.IO): `request.created`, `request.taken`, `pickup.accepted`, `collector.location`, `pickup.arrived`, `pickup.weighed`, `pickup.confirmed`, `pickup.disputed`, `pickup.paid`, `pickup.cancelled`, `request.expired`.

## Milestones

- [x] M0 Project setup
- [x] M1 Backend core: full schema, OTP sign-in, profile, addresses, categories, daily rates
- [ ] M2 Pickup engine: create requests, PostGIS matching with radius widening, first accept wins, pickup code, weighing, disputes, confirm, payment, expiry jobs, Socket.IO events, photo uploads (S3-compatible storage; MinIO locally)
- [ ] M3 Household app screens
- [ ] M4 Collector app screens (and collector sign-up endpoints)
- [ ] M5 Admin panel
- [ ] M6 Pilot readiness: tests, FCM push, monitoring, deployment

The product spec, technical blueprint and clickable prototype (30 screens, logos) live in Rafsun's claude.ai artifacts; the rules above are copied from them.