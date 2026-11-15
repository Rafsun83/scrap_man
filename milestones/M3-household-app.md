# M3 Household app screens

**Finished:** 2026-11-15 · **Status:** every household screen (H1–H14) is built and every check passes. **One check is still open:** a walk-through on a real Android phone (see [Verification](#verification)).

The household app does a full sale:
- sign in with an OTP
- see today's rates and get notified when they're published
- choose items and a slot
- watch a collector accept and approach, on a map when a key is set
- show the pickup code
- check the weights and pick cash, bKash or Nagad
- get the receipt and rate the collector
- report a problem
- see history with totals

It is Bangla first with an English toggle. Live Socket.IO events move every screen forward without a refresh.

M3 had two steps:
1. **2026-11-14:** the screens whose API already existed.
2. **2026-11-15:** the backend those screens were still waiting for (contract first), then the remaining screens.

## Checklist

### Contract and API (step 2)
- [x] `docs/openapi.yaml` updated first, then `pnpm gen:api`:
  - `GET /me/summary` (`MeSummary`)
  - `GET /me/notifications` (`NotificationPage`, `Notification`, `NotificationType`)
  - `POST /me/notifications/read`
  - `Pickup.collectorLocation` and `Pickup.rating`
- [x] `GET /me/summary` (household): completed pickups, kg sold and taka earned, summed in SQL.
- [x] `Pickup.collectorLocation`:
  - the collector's last ping, from `collector_profiles.last_location` and `last_seen_at`
  - shown only to the household and admins, only while ACCEPTED
  - no new storage; every `PUT /collector/location` already updates it
- [x] `Pickup.rating`: `{ stars, comment, createdAt }` from `ratings`, for the household, the assigned collector and admins. H8 no longer needs to guess.
- [x] **Notifications module** `src/modules/notifications/`, the first module built to the backend standard: controllers, services, repositories, entities, dtos, enums.
  - The feed is a **read model** over `status_events`, `disputes` and `daily_rates`, so it always matches what happened. No write path changed and nothing can drift out of sync.
  - Only each user's "seen up to" time is stored, in the new `notification_reads` table.
  - Listed:
    - accepted, released, weighed (re-weighs flagged), paid, expired
    - cancelled by an admin
    - dispute resolved, except REWEIGHED and CANCEL, which already show as weighed or cancelled
    - one RATES_PUBLISHED per day, from the day the account was created
  - The household's own actions aren't listed.
  - Cursor paging; the unread count covers every page.
- [x] Migration `1763280000000-NotificationReads`: `notification_reads` plus a partial index on resolved disputes. Tested up, down, up.

### App base (`apps/mobile`)
- [x] Expo Router:
  - auth stack, and a household stack with 4 tabs (হোম, বিক্রি, ইতিহাস, প্রোফাইল)
  - routes guarded with `Stack.Protected` and a role check
  - collectors see a placeholder until M4
- [x] API client:
  - bearer token
  - one shared refresh on 401 (refresh tokens rotate)
  - sign-out when the refresh is refused
  - `ApiError` and NETWORK errors
  - `Idempotency-Key` per action body
- [x] TanStack Query hooks. Mutation results go straight into the cache. Live events also refresh the notification feed and history totals.
- [x] Session in SecureStore. The language is kept on the device and saved to the account.
- [x] Socket.IO:
  - token auth; refresh and reconnect on `unauthorized`
  - pickup and dispute events refetch the affected data
  - `collector.location` updates the map
  - everything refetches on reconnect and when the app returns to the foreground
- [x] Fonts: Anek Bangla 700/800 and Hind Siliguri 400–700, only those 6 weights bundled.
- [x] Shared UI with an icon and text on every action and 48 px touch targets; loading, error and empty states.
- [x] **Maps:**
  - `react-native-maps` 1.29.11 at the version Expo chose
  - `app.config.ts` reads `GOOGLE_MAPS_API_KEY` from `apps/mobile/.env.local` (kept out of git) and sets `extra.mapsEnabled`
  - the maps module only loads when a key is set, so builds and tests without one never touch it
- [x] Every string is in `@bw/shared` `i18n.ts` in Bangla and English.

### Screens
- [x] **H1 Sign in:** language, role, +880 phone entry; reads Bangla digits and the 0, 880 or +880 forms; rate-limit message.
- [x] **H9 Verify:** 6 boxes with SMS autofill; sends by itself once 6 digits are in; shows tries left; 45 s resend timer.
- [x] **H2 Home:**
  - greeting by Dhaka hour, address area
  - **bell with an unread badge** that opens H13
  - rate board, with a "not published yet" state that disables selling
  - active-pickup banner, recent sales
- [x] **H12 All rates:** change from yesterday, "দেখে দর" for electronics, rate-lock note.
- [x] **H3 Select items:** categories in display order (those with no rate are disabled); weight bands, with UNDER_5 shown as "২–৫ কেজি"; optional photo.
- [x] **H4 Schedule:** address, note, today plus 2 days, slots close at their end, payout preview using the API's formula, idempotent send, then the photo upload.
- [x] **H5 Finding a collector:** radar, search radius, summary, cancel after a confirmation.
- [x] **H6 Collector on the way:**
  - **map** with the home and collector pins when a key is set; a distance and ETA panel otherwise
  - the position starts from `Pickup.collectorLocation`, so it shows straight after reopening, then follows live events (whichever is newer)
  - call button, the code in Bangla digits, progress steps, code-lock warning, report a problem
- [x] **H7 Confirm weight:** the server's lines and totals, the scale photo, cash or bKash or Nagad with a checked wallet number, report the weights.
- [x] **Disputed, waiting for payment, ended:** REWEIGH and ADMIN_REVIEW messages with the previous weights; "send again" after cancelled or expired.
- [x] **H14 Report a problem:** only the types allowed in the current status; details; up to 5 photos.
- [x] **H8 Paid:** amount, method, TrxID, receipt, share. A **saved rating shows as stars** and isn't asked again. "টাকা পাননি?" opens H14.
- [x] **H11 History:** **totals header ("এ পর্যন্ত পেয়েছেন", "মোট বিক্রি")** from `/me/summary`; filters, infinite scroll, badges, empty state.
- [x] **H13 Notifications:**
  - Today and Earlier groups; unread rows highlighted
  - "সব পড়া হয়েছে" marks all read
  - each item opens the right screen: the pickup, a new request (expired), or the rate board (rates)
  - the sentences are written in the app from `type` and `data`, with the prototype's wording
- [x] **H10 Profile:** name, addresses, language, **notifications row**, log out.
- [x] **Address form:** labels, location from GPS, and **a draggable pin** when a maps key is set; Bangladesh-bounds check; set default; delete.

## Verification

| Check | Result |
| --- | --- |
| `pnpm turbo run lint typecheck test build --force` | 12/12 tasks; lint 0 warnings |
| Mobile tests (jest-expo, Testing Library) | 7 files, 62 tests pass |
| Shared tests | 8 pass: same keys in Bangla and English, no empty strings, same placeholders |
| `pnpm test:e2e` | 11 files, **97 tests** pass (10 new) |
| Migration | `migration:revert` then `db:migrate` succeed on the dev database; e2e runs it on the test database |
| Live run on the dev API | A scripted sale (real PostgreSQL, Redis, S3 upload). The samples in `docs/api.md` come from it: feed of paid, weighed and accepted; paging; mark-read sets unread to 0; a collector is refused with 403; `collectorLocation` while ACCEPTED; `rating` after rating |
| `expo config` | Without a key: `mapsEnabled: false`. With `GOOGLE_MAPS_API_KEY`: the key reaches the Android manifest plugin and `mapsEnabled: true` |
| `npx expo export --platform android` | Bundles with and without a maps key (3 MB Hermes bytecode) |
| **On a phone** | **Not run.** This machine has no Android SDK or emulator. Before calling M3 done, run `pnpm dev` and `pnpm dev:mobile` and walk a sale on a phone on the same Wi-Fi, with and without a maps key. Note: `react-native-maps` is a native module, so the map needs a development build (`npx expo run:android` or EAS), not Expo Go. |

New tests, by file:
- `household-views.e2e-spec`:
  - summary totals only this household's completed pickups; zero for a new household; 403 for collectors
  - `collectorLocation`: null before accept; shown to the household while ACCEPTED and follows pings; null for the collector and after arrival
  - `rating` is visible to the household and the collector
- `notifications.e2e-spec`:
  - a full sale gives paid, weighed and accepted, with amounts and names; confirm isn't listed
  - mark-read, then a release counts as 1 unread
  - re-weigh (version 2), resolved dispute and admin cancel are listed; the household's own cancel isn't
  - rates appear once per day and only after sign-up
  - paging and a bad cursor
  - each household sees only its own feed; collectors get 403
- Mobile:
  - `notificationText`: Bangla and English sentences, re-weigh vs first weigh, where taps go, outcomes, unknown collector
  - views: saved location before any live event, a newer live point wins, saved rating not asked again
  - socket: the feed and totals are refreshed

## Decisions taken in M3

- **Notifications are derived, not stored.** Writing a row next to every socket event would mean a second write path that could miss events or drift. Reading `status_events`, `disputes` and `daily_rates` can't disagree with the history. FCM push in M6 can send the same items.
- **Rates notifications:** one per effective date, dated when it took effect or was published, whichever is later. Corrections later the same day don't notify again.
- **Backend standard:** the new feature lives in `src/modules/notifications/` with the required layers.
  - Request DTOs are Zod schemas validated with `ZodPipe`, as CLAUDE.md requires. The skill's class-validator example doesn't apply here.
  - The feed repository reads tables owned by the pickups and catalog code (read-only).
  - The M0–M2 code (`src/pickups`, `src/users`, …) still doesn't match the standard: no `src/modules/`, no repositories. Summary, `collectorLocation` and `rating` were added to it in its current style rather than restructured unasked.
- **Maps key:** read at build time from the environment, never committed. Without one the app still works with the distance panel and GPS-only addresses.
- **Icon plus text on every action,** including back and call, even where the prototype has icon-only buttons.
- **Bangla errors** use our own wording for common codes; English shows the API's message.
- **Dependencies:**
  - Expo packages at the versions `expo install` chose, including `react-native-maps` 1.29.11.
  - Others pinned and at least 14 days old: TanStack Query 5.105.0, Testing Library 14.1.0, test-renderer 1.3.0, Jest 30.5.2, `@react-native/jest-preset` 0.88.1, fonts 0.4.1, socket.io-client 4.8.4.
  - `@parcel/watcher` may skip its build script; it ships prebuilt binaries.

## Open items

- **A walk-through on a real Android phone** in a development build, with and without a maps key, plus a screenshot pass against the prototype.
- **Accounts:** a Google Maps API key, restricted to the app's package and signing certificate.
- **Content:** help and terms pages (H10 rows); this needs approved legal and operations text, not code.
- **M4:** collector screens replace the placeholder, and collectors get their own notification feed (the endpoint is household-only for now).
- **M6:** FCM push for notifications while the app is closed.
- **Follow-up offer:** move `src/pickups`, `src/users`, `src/catalog` and the rest into `src/modules/` with repositories, to match the backend standard.
