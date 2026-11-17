# M5 Admin panel

**Finished:** 2026-11-17 · **Status:** all five admin pages (A1–A5) and the endpoints behind them are built, and every check passes. They were also checked in a real browser (headless Chrome) against the dev API. **Still open:** a walk-through by the operations team on a real screen (see [Open items](#open-items)).

Operations staff can now:
- sign in with their phone and OTP
- watch live pickups: counts, what needs attention, a searchable table, a map of open requests and online collectors
- open any pickup with its timeline, and cancel it with a reason
- set and publish each day's rates
- approve or reject collectors after three checks
- resolve disputes, including entering a team re-weigh
- flag or suspend users

The panel is English first with a Bangla toggle, and live events keep it current.

## Checklist

### Contract (`docs/openapi.yaml` first, then `pnpm gen:api`)
- [x] `GET /admin/overview` (`AdminOverview`, `AttentionItem`): status counts, completed today, pending applications, open disputes, and the needs-attention list (`CODE_LOCKED`, `DISPUTE_REVIEW`, `WAITING_TOO_LONG`, `RELEASES`).
- [x] `GET /admin/map` (`AdminMap`): open requests (with an overdue flag) and online collectors (with a busy flag).
- [x] `GET /admin/pickups`: rules written down. Adds `group` (ACTIVE, WEIGHING, PAST), `q` (BW number, name, phone) and `userId`; `area` matches anywhere in the area, any case.
- [x] `GET /admin/pickups/{id}/events` (`PickupEvent`): the timeline.
- [x] `GET /admin/rates?date=` (`AdminRates`): the rate for exactly that date, next to the previous rate.
- [x] `GET /admin/disputes` now returns `AdminDispute` (area, pickup status, both names) and takes a `type` filter.
- [x] `GET /admin/users` returns `AdminUserRow` / `AdminUserPage`: household and collector figures plus `releaseFlag`.
- [x] `PUT /admin/users/{id}/status`: rules and errors written down (403 for admin accounts; suspending takes a collector offline).
- [x] `Pickup.updatedAt`: the latest status change.
- [x] New socket event `collector.applied` (admins only).
- [x] `@bw/shared`:
  - `ADMIN_ATTENTION` (60 minutes, more than 5 releases in 30 days), `USER_STATUSES`
  - admin strings in `admin-i18n.ts`: English and Bangla, with a key and placeholder parity test
  - `contract-checks.ts` covers the new socket event

### API (`apps/api`, to the backend standard)
- [x] **Migration** `1763452800000-AdminPanel`:
  - `users.status_note`
  - a partial index for release counts
  - `pickups (status, requested_at DESC)` for counts and search
  - tested up, down, up
- [x] **Pickups module:**
  - admin search (`PickupsRepository.adminPageIds`)
  - the timeline (`events`)
  - `updatedAt` on every pickup
  - disputes with area and names
- [x] **Catalog module:** `GET /admin/rates`, beside the existing publish.
- [x] **Users module:** `UsersService.setStatus` (refuses admin accounts; a suspended collector goes offline).
- [x] **Collectors module:** sends `collector.applied` on sign-up.
- [x] **New module `src/modules/admin/`:** a read model like the notifications feed.
  - `AdminReadRepository` reads tables the other modules own: counts, attention, map points, user rows. Release counts and totals are summed in SQL.
  - Status changes go through `UsersService`.
- [x] Each table stays with its owning module. Pickup search and disputes live in pickups; rates by date in catalog.

### Admin panel (`apps/admin`)
- [x] **Base:**
  - React Router 8, with each page loaded on first visit (the Leaflet map only downloads with Live pickups)
  - TanStack Query; Socket.IO events refresh the counts, table, map, pickup, timeline, disputes, queue and badges
  - a "live updates paused" note while disconnected
- [x] **Sign-in:**
  - phone and OTP; refuses non-admin numbers (and signs that session out)
  - the access token stays in memory; the refresh token is kept in the browser, so a reload signs back in
  - one shared refresh when several calls hit 401 at once
- [x] **Formatting:** Dhaka dates and times are built by hand (Bangla month names, time-of-day words and digits), so they don't depend on the browser's locale data.
- [x] **A1 Live pickups:**
  - date; search box; area box with suggestions from the 43 Dhaka areas
  - status cards that act as filters
  - needs-attention list with "View" (opens the pickup, the dispute, or the collector on A5)
  - pickups table with "Show more" paging
  - map (OpenStreetMap through Leaflet, no key; refreshed every 30 s)
  - pickup drawer: people and phones, address, slot, items, weigh rounds, payment, photos, timeline, the code-lock warning, cancel with a reason
- [x] **A2 Daily rates:**
  - date picker (today or later)
  - previous rate with its date; rates typed with up to 2 decimals and checked
  - change column; electronics shown as "collector quotes at the door"
  - "Copy previous rates"; an unpublished-changes banner
  - publish sends only what changed, after a confirmation
  - past dates are read-only
- [x] **A3 Collector approvals:**
  - Pending, Approved and Rejected tabs, oldest application first
  - selfie, phone, areas, vehicle, scale, masked NID
  - three checks before Approve unlocks; a note required to Reject; the decision and note shown afterwards
- [x] **A4 Disputes:**
  - Open and Resolved, with a type filter
  - list with both names and the status
  - detail: call both sides, reason and photos, weigh-round table, scale photo per round, payment and TrxID for payment reports, timeline
  - only the resolutions the API accepts for that type (no Cancel once the pickup is finished), with a note to both sides
  - after a team re-weigh, the dispute stays under Open with a team-weights form (kg, a quote for electronics, a scale photo upload)
- [x] **A5 Users:**
  - Households and Collectors tabs; search by name or phone
  - the prototype's columns; release-flagged rows highlighted, with the threshold note
  - user drawer: details, Active / Flagged / Suspended with a note, a suspend warning, a warning when the collector has pickups in progress, and the user's pickups (each opens the pickup drawer)
- [x] Every page has loading, empty and error states.
- [x] The Vite dev proxy also forwards Socket.IO. `API_TARGET` points it at another API (default `localhost:3000`).

## Verification

| Check | Result |
| --- | --- |
| `pnpm turbo run lint typecheck test build` | 13/13 tasks; lint 0 warnings in api and admin |
| `pnpm test:e2e` | 13 files, **121 tests** pass (12 new: `admin.e2e-spec` 11, `realtime` +1) |
| Admin tests (Vitest, Testing Library, jsdom) | 10 files, **29 tests** pass |
| API unit, mobile, shared | 30, 89 and 11 pass |
| Migration | up, down and up on the dev database |
| Live run through the dev proxy | A scripted run created two weight disputes, a payment report, an accepted pickup, open requests and a pending applicant. Every M5 endpoint answered 200; the samples in `docs/api.md` come from it |
| **In a browser** | Headless Chrome against the dev API and proxy. Screenshots of every page in English, and the disputes page in Bangla. A dispute was resolved through the page with "Send a team member": it stayed under Open with the team-weights form. This pass caught two Bangla bugs, both fixed and covered by tests: round numbers in English digits, and times from the browser's `bn-BD` locale |
| `vite build` | Split by page; the largest chunk is the Live pickups page with Leaflet (160 kB, 47 kB gzipped) |

New tests:
- `admin.e2e-spec` (11):
  - counts and attention in urgency order; nothing flagged below the thresholds
  - map points with busy and overdue flags
  - search by group, status, area, BW number, phone, user and date, with paging; `updatedAt` matches the timeline
  - the timeline with actors and meta
  - rates by date (published / previous / who published)
  - disputes with names and the type filter
  - user rows with household and collector figures, search and paging
  - flag, suspend (blocked, offline), re-activate; 403 for an admin target, 404, 400
  - role limits on every route
  - `updatedAt` on every pickup
- `realtime.e2e-spec` (+1): `collector.applied` reaches admins only.
- Admin:
  - the client's shared refresh and errors
  - rate draft logic
  - resolutions per dispute type and the team re-weigh state
  - timeline wording in both languages
  - live-event cache updates
  - team-weight lines
  - Dhaka formatting
  - sign-in (an admin is let in; a household number is refused and signed out)
  - A3 checks and the reject note
  - A2 copy, the banner, validation, and publishing only the changes

## Decisions taken in M5

These were agreed before building:
- **Map:** Leaflet with OpenStreetMap tiles; no key or billing.
- **Dependencies:** pinned and at least 14 days old: `react-router` 8.5.1, `@tanstack/react-query` 5.105.0, `socket.io-client` 4.8.4, `leaflet` 1.9.4, `react-leaflet` 5.0.0. For development: `@types/leaflet` 1.9.22, `vitest` 4.1.12, `@testing-library/react` 16.3.3, `@testing-library/user-event` 14.6.8, `jsdom` 30.1.3. No jest-dom; tests use plain DOM checks.
- **Suspending a collector mid-pickup:** suspend and take them offline; pickups in progress stay as they are, and the panel warns the admin.
- **Thresholds:** 60 minutes waiting, and more than 5 releases in 30 days (`ADMIN_ATTENTION`).

Taken while building:
- **Where the code lives:** reads that only touch one module's tables went to that module (search, timeline, disputes in pickups; rates in catalog). The cross-table views (overview, map, user rows) are one read-only module, as with notifications.
- **`CODE_LOCKED` attention time:** no lock time is stored, so it shows the accept time; the contract says so.
- **Area filter:** the address area is free text, so the filter is a substring match with suggestions from the Dhaka list, not a fixed dropdown.
- **Team re-weigh:** after `TEAM_REWEIGH` the dispute is resolved but the pickup still waits, so the panel keeps it under Open until the team's weights are saved.

## Open items

- **Operations walk-through** on a real screen with the team. Also, decide whether OpenStreetMap's public tiles are acceptable for the pilot or should move to a tile provider.
- **Your `pnpm dev`:** during the live run, your `nest start --watch` API on port 3000 stopped after I touched `app.module.ts` to make it rebuild (I didn't stop it on purpose). Start it again with `pnpm dev`. For the screenshots I ran my own API on port 3001 and Vite on 5174, and stopped them afterwards.
- **M6:**
  - FCM push (including the collector notification feed)
  - monitoring and alerts (the spec's "alerts on stuck pickups and payment reports" could reuse `/admin/overview`)
  - deployment
  - background location
- **Follow-up:** the mobile app and the admin panel each have their own copy of the API client and the Dhaka date formatting. They could move to `@bw/shared`.
