# M3 Household app screens

**Date:** 2026-11-14 · **Status:** in progress. Every household screen whose backend already exists is built and tested. Three screens still need backend work (see [Waiting on backend](#waiting-on-backend)), so M3 is not ticked in CLAUDE.md yet.

The mobile app now does the whole household sale:
- sign in with an OTP
- see today's rates
- choose items and a slot
- watch the request find a collector
- show the pickup code
- check the weights and pick cash, bKash or Nagad
- get the receipt and rate the collector
- report a problem

All of it is in Bangla first, with an English toggle. Live Socket.IO events move every screen forward without a refresh. No API code or contract changed in this step.

## Waiting on backend

| Screen | What is built now | What is missing | Backend work needed |
| --- | --- | --- | --- |
| **H13 Notifications** | Not built. The bell on H2 and the notifications row on H10 are left out. | Nothing stores notifications. "Rates published" isn't a socket event, and events sent while the app is closed are lost. | A `notifications` table written alongside each socket event, `GET /me/notifications` and `POST /me/notifications/read`, plus a daily "rates published" entry for households. FCM push (M6) can reuse it. Contract first. |
| **H11 History**: totals header ("এ পর্যন্ত পেয়েছেন ৳১,৪৭০", "মোট বিক্রি ৩৮.৫ কেজি") | Filters, list, cursor paging, pull to refresh, and empty states are all built. Only the two totals cards are left out. | Adding up a paged list gives wrong totals. | `GET /me/summary` → `{ completedCount, totalKg, totalAmount }` over COMPLETED pickups. |
| **H6 Tracking**: map | Collector card, call button, pickup code, progress steps, a code-lock warning, and live distance and ETA from `collector.location`. A plain panel stands where the map would be. | The app has no collector position until the next `collector.location` event, so reopening the app mid-trip shows "waiting for location". There's also no Google Maps key yet. | `Pickup.collectorLocation { lat, lng, at } \| null`, the last known position, shown only to the household while ACCEPTED (from Redis, written by `PUT /collector/location`). Then add `react-native-maps` with a Maps API key; that last part is an account task, not code. |

Smaller gaps:
- **H8 rating:** `Pickup` has no "already rated" field. The app learns it only when the API refuses a second rating (INVALID_STATE), then shows "আগেই রেটিং দিয়েছেন". A `rating: number | null` field on `Pickup` would let H8 show the saved stars.
- **H10 help and terms rows:** left out because there's no content yet. This needs legal and operations text, not an endpoint.
- **H10 address map pin:** the address form takes the phone's GPS position and has no draggable pin. This waits on the same maps key as H6.

## Checklist

### App base (`apps/mobile`)
- [x] Expo Router (`app/`): an auth stack and a household stack with 4 tabs (হোম, বিক্রি, ইতিহাস, প্রোফাইল). Signed-in and signed-out routes are guarded with `Stack.Protected`; the household layout also checks the role.
- [x] Signing in as a collector opens a placeholder screen until M4.
- [x] API client (`src/api/client.ts`):
  - sends the bearer token
  - one shared refresh on 401, since refresh tokens rotate and work once
  - signs out when the refresh token is refused
  - `{ code, message, details }` becomes `ApiError`; no connection becomes NETWORK
  - adds the Idempotency-Key header
- [x] Query hooks (`src/api/hooks.ts`, TanStack Query):
  - one Idempotency-Key per action body, reused on retry
  - a mutation's result goes straight into the cache, so the screen moves on before the socket event arrives
- [x] Session in SecureStore. The language is remembered on the device and saved to the account with `PATCH /me`.
- [x] Socket.IO (`src/realtime/socket.tsx`):
  - authenticates with the access token
  - on `unauthorized`, refreshes the token and reconnects
  - `pickup.*`, `dispute.*` and `request.expired` refetch the pickup and the lists
  - `collector.location` updates the H6 distance
  - everything refetches on reconnect and when the app comes back to the foreground
- [x] Fonts: Anek Bangla 700/800 and Hind Siliguri 400–700. Only those six weights are bundled.
- [x] Shared UI (`src/ui/`): buttons with an icon and text, at least 48 px tall; cards, chips, radio rows, fields, notes; loading, error and empty states.
- [x] Every string is in `@bw/shared` `i18n.ts` in Bangla and English, with `{placeholders}`. Digits, taka, kg, dates and times are shown in Dhaka time.

### Screens
- [x] **H1 Sign in:**
  - language toggle, role choice, +880 phone entry
  - reads Bangla digits and the 0, 880 or +880 forms
  - message for OTP_RATE_LIMIT
- [x] **H9 Verify:**
  - 6 code boxes with SMS autofill
  - sends the code by itself once 6 digits are in
  - wrong code shows the tries left; 45 s resend timer
- [x] **H2 Home:**
  - greeting by Dhaka hour, default address area, rate board
  - "not published yet" state, in which selling is disabled
  - banner for an active pickup, the 3 most recent sales
- [x] **H12 All rates:** rate per category with the change from yesterday; electronics "দেখে দর"; the rate-lock note.
- [x] **H3 Select items:**
  - category cards in display order; categories with no rate today are disabled
  - weight bands, with UNDER_5 shown as "২–৫ কেজি" as the contract says, plus the 2 kg minimum note
  - optional photo from the camera or gallery
- [x] **H4 Schedule:**
  - default address with a way to change it or add one, note to the collector
  - today plus 2 days; slots close at their end, as the API checks
  - payout preview that matches the API's estimate formula
  - sends with an Idempotency-Key, then uploads the item photo
- [x] **H5 Finding a collector:** pulsing radar, the search radius (widens to 3 km), request summary, cancel after a confirmation.
- [x] **H6 Collector on the way:**
  - covers ACCEPTED and ARRIVED, with the call button and the code in Bangla digits
  - progress steps, code-lock warning, report a problem
  - no map (see above)
- [x] **H7 Confirm weight:**
  - the server's lines and totals, scale photo for the current weigh round
  - cash, bKash or Nagad; the wallet number is checked and sent as +880
  - "ওজনে সমস্যা" opens H14 with WEIGHT
- [x] **Disputed:** REWEIGH and ADMIN_REVIEW messages with the previous weights. **Waiting for payment** (CONFIRMED). **Ended** (CANCELLED or EXPIRED), with "send it again".
- [x] **H14 Report a problem:**
  - shows only the types the contract allows in the current status, and none while a dispute is open
  - details, up to 5 photos uploaded as ITEMS
- [x] **H8 Paid:**
  - amount, method and wallet, TrxID, receipt lines, share
  - stars sent once
  - "টাকা পাননি?" opens H14 with PAYMENT; a "being reviewed" note once reported
- [x] **H11 History:** all, active, done and cancelled filters, infinite scroll, pull to refresh, status badges, empty state with "sell scrap" (no totals header, see above).
- [x] **H10 Profile:** edit name, list addresses (default marked), language toggle, log out. Add, edit and delete an address, with location from GPS, a Bangladesh-bounds check and set default.

## Verification

| Check | Result |
| --- | --- |
| `pnpm turbo run lint typecheck test build --force` | 12/12 tasks pass; lint 0 warnings |
| Mobile tests (`jest-expo`, Testing Library) | 6 files, 55 tests pass |
| Shared tests | 8 pass, including: every key in both languages, no empty strings, same placeholders in bn and en |
| `pnpm test:e2e` (API) | 9 files, 87 tests pass; the API is unchanged |
| `npx expo export --platform android` | Bundles (2.9 MB Hermes bytecode plus 6 font files) |
| On a device or emulator | **Not run.** This machine has no Android SDK or emulator. Run `pnpm dev` and `pnpm dev:mobile` and walk a sale with a phone on the same Wi-Fi before ticking M3. |

What the tests cover, by file:
- `lib/dhaka`: Dhaka day boundary, slot ends equal the API's, bookable slots before and after a slot ends, Bangla and English dates and times.
- `lib/format`: phone parsing (Bangla digits, prefixes), estimate equals the API's spec values, distance and ETA, initials, Bangladesh bounds.
- `lib/pickupView`: every status → screen, progress steps, dispute types allowed per status, scale photo per weigh round.
- `api/client`: bearer token, query and Idempotency-Key; refresh and retry; one shared refresh for 2 concurrent 401s; sign-out on a refused refresh; no refresh for OTP calls; NETWORK and 204 handling.
- `realtime/socket`: which events refetch which queries; collector-only events are ignored; location doesn't refetch.
- `household/pickup/views`:
  - H5 cancel confirmation
  - H6 code shown or hidden, distance and ETA, lock warning
  - H7 totals and lines, cash body, bKash body with the +880 number, a bad wallet blocked, report hidden during a dispute, English mode
  - H8 receipt, a rating saved, already rated
  - expired → send again

## Decisions taken in M3

- **Only screens with a working backend were built.** No contract or API change was made in this step (Rafsun's call). The gaps are listed above.
- **Routing:** one route `pickup/[id]` chooses its view from the status, so a live event or a reload always lands on the right screen. The Sell tab opens the two-step flow on top of the tabs.
- **Icon plus text on every action,** including back and call. The prototype has icon-only buttons there; the project rule wins.
- **Bangla error text:** the API's messages are English. Bangla mode shows our own wording for the common codes; English mode shows the API's message.
- **Dependencies:**
  - Expo packages at the versions `expo install` chose.
  - Others pinned exactly and at least 14 days old: TanStack Query 5.105.0, Testing Library 14.1.0, test-renderer 1.3.0, Jest 30.5.2, `@react-native/jest-preset` 0.88.1, fonts 0.4.1. socket.io-client 4.8.4 is the version the API tests already use.
- **`pnpm-workspace.yaml`:** `@parcel/watcher` (pulled in by Jest) is allowed to skip its build script. It ships prebuilt binaries; the script only builds from source as a fallback.
- **TypeScript 6:** `types` now defaults to none, so `apps/mobile/tsconfig.json` lists `jest`.

## Open items

- The backend work in [Waiting on backend](#waiting-on-backend), then H13, the H11 totals and the H6 map.
- A walk-through on a real Android phone (and a screenshot pass against the prototype).
- M4: the collector screens replace the placeholder that collectors see after sign-in.
