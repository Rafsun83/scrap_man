# M1: Backend core

Status: **built and tested; check it on your machine** (list at the end).

The full database schema, phone sign-in, profiles, saved addresses, categories and daily rates.

## Database
- [x] Migration `CoreSchema`: all 13 tables from the blueprint and their 14 enum types
- [x] Keys, unique rules and checks: phone format, NID format, one default address per user, one rate per category per day, rates above 0, kg above 0, TrxID required for bKash and Nagad, a TrxID usable once, stars 1 to 5
- [x] A pickup cannot pass REQUESTED without a collector
- [x] Location indexes (PostGIS GiST) for online collectors and open requests
- [x] Pickup numbers from a sequence starting at 1001 (shown as BW-1001)
- [x] Migration runs up, down and up again cleanly
- [x] Pickup tables created now, used from M2

## Common building blocks
- [x] Every error leaves the API as `{ code, message, details }`, with plain messages
- [x] Request validation with Zod; errors name each wrong field
- [x] `@Public()`, `@Roles(...)` and `@CurrentUser()` decorators
- [x] Dhaka-time "today" for rates and slots
- [x] One app setup shared by the server and the tests

## Sign-in with OTP
- [x] `POST /auth/otp/request`: sends a 6-digit code by SMS
- [x] Limits: 3 codes per number and 10 per IP address in 10 minutes
- [x] `POST /auth/otp/verify`: signs in, or signs up with the chosen role; a number keeps its first role
- [x] Codes stored hashed, expire after 5 minutes, work once, and are discarded after 5 wrong tries
- [x] Access token (JWT, 15 minutes) and refresh token (30 days, stored hashed in Redis)
- [x] `POST /auth/refresh`: each refresh token works once
- [x] `POST /auth/logout`: ends the session
- [x] Every route requires sign-in unless marked public; suspended accounts are blocked
- [x] Development code `123456` (`OTP_DEV_CODE`), refused in production; SMS printed to the API log

## Profile and addresses
- [x] `GET /me`, `PATCH /me`: name and language (BN or EN)
- [x] `GET`, `POST /me/addresses`, `PATCH`, `DELETE /me/addresses/{id}` for households
- [x] Up to 10 addresses; the first is the default; a new default replaces the old one
- [x] Removing the default makes the newest remaining address the default
- [x] Locations outside Bangladesh are refused; one user can't touch another's addresses

## Categories and rates
- [x] `GET /categories`: the six categories in display order, public
- [x] `GET /rates/today`: latest rate per category and the change from the previous day, public
- [x] `PUT /admin/rates`: admins publish or correct rates for today or a later date
- [x] Past dates, unknown categories and electronics (priced at the door) are refused

## Seed
- [x] `pnpm db:seed`: the six categories and the admin account from `ADMIN_PHONE`
- [x] `pnpm db:seed -- --sample-rates`: today's sample rates for development

## Tests
- [x] Unit tests: settings, Dhaka date, rate change, health (11 in the API, 4 in shared)
- [x] End-to-end tests against real Postgres and Redis: sign-in (10), profile and addresses (9), categories and rates (6)
- [x] Tests use their own database (`bhangariwala_test`) and Redis db 15, and refuse a database whose name doesn't end in `_test`
- [x] Docker creates the test database on a fresh volume; CI runs the e2e job against it

## Contract and docs
- [x] `docs/openapi.yaml`: added `POST /auth/logout` and the `UNAUTHORIZED` error code; types regenerated
- [x] README: M1 setup, development sign-in, API table
- [x] `.env.example`: JWT secret, token and OTP timings, dev code, admin phone, test URLs

## Fixed while testing
- [x] A blank `OTP_DEV_CODE=` made every code empty; blank now means random codes

## Small changes from the blueprint
- [x] The language enum is named `app_language` (`language` clashes with a Postgres name)
- [x] `weigh_lines.rate` can be empty, for electronics priced at the door
- [x] Added `POST /auth/logout` and the `UNAUTHORIZED` error code

## Checked before handing over
- [x] Frozen install, lint, typecheck, test and build: 11 of 11 tasks
- [x] 25 of 25 end-to-end tests
- [x] Manual run: admin signed in and changed the iron rate to ৳52; a household signed up and saved a Bangla address with its location; the household was refused on the admin route

## To do on your machine
- [ ] Apply the root `package.json` script fix so `db:migrate`, `db:seed` and `test:e2e` build `@bw/shared` first, and `postinstall` builds it after install
- [ ] Create the test database once: `docker compose exec postgres createdb -U bw bhangariwala_test`
- [ ] Copy the new settings: `cp .env.example apps/api/.env`
- [ ] `pnpm db:migrate` and `pnpm db:seed -- --sample-rates`
- [ ] `pnpm turbo run lint typecheck test build` passes
- [ ] `pnpm test:e2e` passes (25 tests)
- [ ] Sign in with `+8801700000000` and code `123456`; `GET /api/v1/rates/today` shows the sample rates
- [ ] Commit, push, and check both CI jobs pass on GitHub

## Left for later milestones
- [ ] Real SMS gateway in place of the console sender (before launch)
- [ ] Collector sign-up and approval endpoints (M4, with the collector app)
- [ ] Update the technical blueprint doc with the small changes above