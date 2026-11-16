# M4 Collector app screens

**Finished:** 2026-11-16 · **Status:** every collector screen (C1–C11) and the collector sign-up and approval endpoints are built, and every check passes. **One check is still open:** a walk-through on a real Android phone (see [Verification](#verification)).

The collector side of the app now does the whole job:
- sign up with name, NID number, a selfie taken on the spot, work areas, vehicle and scale
- wait for approval, or see the admin's reason and apply again
- go online and see nearby requests appear and disappear live
- read a request (area and distance only), then accept
- see the address, call, get directions, and enter the household's code
- weigh in front of the household, including items found at the door, with a scale photo, keeping a draft on the phone when offline
- re-weigh after a first dispute
- pay by cash, bKash or Nagad with the TrxID
- see today's, upcoming and past pickups, the ledger, and the profile

It is Bangla first with an English toggle, like the household side.

## Checklist

### Contract (`docs/openapi.yaml` first, then `pnpm gen:api`)
- [x] `POST /collector/selfie`: presigned upload slot for the sign-up selfie (`UploadSlot`).
- [x] `POST /collector/signup`: errors written down (409 when PENDING or APPROVED; 400 when the selfie isn't this collector's or isn't uploaded). A REJECTED collector may apply again.
- [x] `GET /collector/profile`: 404 before sign-up. `PATCH /collector/profile`: at least one field.
- [x] `WorkArea` enum (43 Dhaka areas) and `WorkAreas` (1–10, unique).
- [x] `CollectorProfile`: every field required; adds `verificationNote`, `submittedAt`, `decidedAt`; `name` nullable. `CollectorProfilePage`.
- [x] `GET /collector/ledger`: Dhaka dates, inclusive, at most 92 days; nested fields required.
- [x] `Pickup.lockedRates`: rates copied at accept, for C4's live total.
- [x] `NearbyRequest.requestedAt` and `expiresAt`; `estimate` nullable, as the code already returned.
- [x] `/me/pickups?status=PAST`: COMPLETED, CANCELLED and EXPIRED (C8).
- [x] Weigh rounds may add a category the household didn't list. It takes the rate in effect at that moment; a category that has never had a rate gets 400.
- [x] `/admin/collectors` and `/admin/collectors/{userId}/decision`: rules and errors written down (a rejection needs a note).
- [x] New socket event `collector.verification` (`EventCollectorVerification`).

### API (`apps/api`, to the backend standard)
- [x] **Migration** `1763366400000-CollectorOnboarding`:
  - new `collector_selfies` table
  - `collector_profiles.selfie_id` replaces the never-written `selfie_url`
  - new columns `verification_note`, `submitted_at`, `decided_at`, `decided_by`
  - `collector_queue_idx` for the admin queue
  - tested up, down, up
- [x] **New module `src/modules/collectors/`** (controllers, services, repositories, entities, dtos):
  - selfie slot (at most 20 per collector)
  - sign-up, profile and work details; the NID is masked in every response (`19XX XX 4321`)
  - admin queue (oldest first, cursor paging)
  - decision: SMS in the collector's language plus `collector.verification`. A failed SMS doesn't undo the decision.
- [x] **Users module** keeps ownership of `collector_profiles` (matching reads it too). New repository and service operations:
  - an atomic apply / apply-again (one `INSERT … ON CONFLICT … WHERE REJECTED`)
  - change work details
  - a decision that only applies while PENDING
  - the queue page
- [x] **Pickups module:**
  - `LedgerRepository` and `CollectorLedgerService`: ledger sums in SQL; 30-day pickups and releases for the profile; exported to `collectors`
  - `lockedRates`, the nearby fields, the `PAST` filter
  - items found at the door in `WeighingService`
- [x] **SMS** moved out of `auth` into `src/modules/sms/` (`SmsModule`), because auth and collectors both send SMS now.

### App base (`apps/mobile`)
- [x] Routes under `app/(collector)`:
  - `/collector` gate: sign-up, waiting, or the work tabs, from `GET /collector/profile`
  - `/join` (C6), `/pending` (C7)
  - tabs `(work)`: `/requests` (C1), `/jobs` (C8), `/ledger` (C9), `/account` (C11)
  - `/request/[id]` (C2), `/job/[id]` (C3, C4, C10, C5 and the waiting states)
  - `/work-details`
  - none clash with household paths
- [x] Collector hooks in `src/collector/api.ts`. Mutation results go straight into the query cache.
- [x] **Live updates:**
  - `request.created` adds to the nearby list (nearest first), `request.taken` removes from it, with no refetch
  - `collector.verification` refetches the profile
  - `pickup.paid` refetches the ledger
- [x] **Location** (`src/collector/location.ts`):
  - a ping every 30 s, and on return to the app, while approved and online or with an ACCEPTED pickup
  - accept sends a fresh ping first, because the server checks distance from the last one
  - only while the app is open (decision below)
- [x] **Offline weigh draft** (`src/collector/weighDraft.ts`):
  - lines, scale photo, uploaded photo id and Idempotency-Key are kept in SecureStore per pickup and round
  - a send that fails for lack of connection is queued and retried every 15 s and on return to the app, with the same key, so it is never weighed twice
  - the photo isn't uploaded again on a retry
  - a refused scale photo clears it and asks for a new one
- [x] Camera-only capture for the selfie (front camera) and the scale photo (back camera).
- [x] 190 new strings in `@bw/shared` `i18n.ts` (Bangla and English); the placeholder collector strings are removed.
- [x] The language switch is now one component (`src/ui/LanguageSwitch.tsx`) used by H10 and C11.
- [x] `EXPO_PUBLIC_SUPPORT_PHONE` sets the support line. The "call for help" buttons hide without it.

### Screens
- [x] **C6 Sign up:**
  - name, verified phone, NID (Bangla digits accepted; 10/13/17 checked), selfie
  - areas (up to 10), vehicle, scale, agreement
  - uploads the selfie, then applies
  - after a rejection it opens with the earlier answers filled in
- [x] **C7 Waiting:**
  - steps and the application summary; pull to refresh
  - rejected state with the admin's note and "আবার আবেদন করুন"
  - moves on by itself on approval
- [x] **C1 Nearby:**
  - greeting; online switch (asks for location; clear messages when it is denied or unavailable)
  - today's pickups, kg and taka from the ledger
  - current-pickup banner
  - request cards: area, নতুন badge (first 10 minutes), photo tag, distance, items, slot, weight band
  - offline, empty, loading and error states
- [x] **C2 Request detail:**
  - area and distance only, a note that the address comes after accept
  - items at today's rates, estimate, "first to accept wins"
  - ALREADY_TAKEN / OUT_OF_RANGE / cancelled messages; বাদ দিন hides the request on this phone
- [x] **C3 Arrive:**
  - name, address, note, items, call, directions (Google Maps link, no key needed)
  - 4-digit code (Bangla digits accepted), tries left, the locked state
  - "গ্রাহককে পাওয়া যাচ্ছে না" sheet: call the household, call support, or give the request back with a reason
- [x] **C4 Weigh:**
  - ±0.5 kg steppers with typed entry to 0.1 kg; a quote for electronics
  - "অন্য জিনিস যোগ করুন" for items found at the door (categories that can be priced today)
  - the scale photo is required
  - live line amounts and total from `lockedRates`, rounded like the server
  - offline-queued note
- [x] **C10 Re-weigh:** the household's reason, previous kg per line, a new photo required, a warning that a second dispute goes to staff.
- [x] **Waiting states:**
  - WEIGHED (the weigh lines are shown while the household checks)
  - DISPUTED with staff
  - DONE (amount, kg, rating received, "not received" report under review)
  - ENDED (cancelled, expired, or given back)
- [x] **C5 Pay:**
  - amount, kg and items, the household's choice and wallet number
  - cash hand-over line, or the TrxID (6–30 letters or digits, uppercased)
  - TRX_ID_REUSED message
  - also the PAY_AGAIN case after a "not received" report
- [x] **C8 My pickups:** আজ (today and overdue), আসন্ন, আগের (cursor paging), badges, empty states.
- [x] **C9 Ledger:**
  - আজ / এই সপ্তাহ (from Saturday) / এই মাস
  - paid, kg and pickups; kg by item; cash / bKash / Nagad
  - each payment with time, method and TrxID
- [x] **C11 Profile:**
  - selfie, name, phone, rating, pickups and releases in the last 30 days
  - work details with "বদলান"
  - verification rows (NID masked; card check "পরে চাওয়া হবে")
  - language, support, log out

## Verification

| Check | Result |
| --- | --- |
| `pnpm turbo run lint typecheck test build` | 12/12 tasks; lint 0 warnings |
| `pnpm test:e2e` | 12 files, **109 tests** pass (12 new) |
| API unit tests | 30 pass |
| Mobile tests (jest-expo, Testing Library) | 12 files, **89 tests** pass (27 new) |
| Shared tests | 9 pass. `contract-checks.ts` fails the typecheck if `WORK_AREAS` or `SOCKET_EVENTS` drift from the contract |
| Migration | `migration:revert` then `migration:run` succeed on the dev database; e2e runs it on the test database |
| Live run on the dev API | A scripted collector journey on the real stack (PostgreSQL, Redis, SeaweedFS presigned uploads): sign in, 404 profile, selfie upload, sign-up, 403 online while pending, admin queue, approve (Bangla SMS logged), online, nearby, accept, wrong code (422), arrive, scale upload, weights with carton added at the door, bKash confirm, payment, ledger, 400 on a bad range, past pickups, change work details. The M4 samples in `docs/api.md` come from it |
| `npx expo export --platform android` | Bundles (3.2 MB Hermes bytecode) |
| **On a phone** | **Not run.** This machine has no Android SDK or emulator. Before calling M4 done, run `pnpm dev` and `pnpm dev:mobile`, sign in as a household on one phone and as a collector on another, and walk a sale: sign-up, approve (Postman or curl until A3 in M5), online, accept, code, weigh with airplane mode on and off, confirm, pay. |

New tests, by file:
- `collectors.e2e-spec` (8):
  - the whole application (apply, reject with a note, apply again, approve, go online)
  - another collector's selfie and invalid applications refused
  - role limits
  - admin queue paging
  - work details
  - ledger sums by method and category, a REPORTED payment dropping out, 30-day count
  - ledger date range checks
  - releases count and the PAST filter
- `weighing.e2e-spec` (+3): `lockedRates` visibility and that it ignores later corrections; an item found at the door priced at today's rate; a never-rated item refused and nothing added.
- `realtime.e2e-spec` (+1): `collector.verification` reaches the applicant and admins only.
- Mobile:
  - routing by verification and by pickup status (REWEIGH vs staff review, PAY_AGAIN)
  - today/upcoming split
  - stepper and typed-kg maths, server-matching totals, API lines
  - ledger ranges (Saturday week, Dhaka day)
  - the draft: upload once, queue offline, retry with the same key, reset on a refused photo
  - nearby cache events
  - C3 code entry and give-back
  - C4 live total and send
  - C10 previous weights
  - C5 TrxID rules and cash

## Decisions taken in M4

These were agreed before building:
- **Items found at the door** can be added at weighing, at the rate in effect at that moment.
- **"Can't find the customer"** uses what exists: call the household, call support, or give the request back. A no-show state is left for later.
- **Location is sent only while the app is open.** Background tracking needs Play Store approval and a foreground service; that is decided in M6.
- **The collector notification feed** waits for M6 with FCM push. Socket events and the waiting screens cover live updates for now.
- **The admin approval endpoints are in M4 (API only).** The A3 screen stays in M5.

Taken while building:
- **Who owns `collector_profiles`:** the users module keeps the table and its repository; `collectors` owns the selfies and the workflow and calls the users service. Moving the table would have made users and collectors depend on each other, because suspending a user takes the collector offline.
- **Selfies have their own table.** `pickup_photos.pickup_id` is NOT NULL, and selfies are a different privacy class. The never-written `selfie_url` column was dropped for a `selfie_id` reference; links are presigned on read.
- **C2 is built from the nearby list.** The API keeps `GET /pickups/{id}` private until accept, so no endpoint was needed.
- **The week in C9 starts on Saturday,** like the working week in Bangladesh.
- **Unrelated fix:** one flaky e2e assertion (a 4-digit code could appear by chance inside its SHA-256 hex digest, about 1 run in 100) now checks the digest format instead.
- **Dependencies:** none added.

## Open items

- **A walk-through on two real Android phones** in a development build (household and collector), including the offline weigh draft. Plus a screenshot pass against the prototype.
- **Content:**
  - the support phone number (`EXPO_PUBLIC_SUPPORT_PHONE`)
  - the collector agreement text that the C6 tick box and the C11 row point to: legal and operations text, not code
- **M5:** the A3 approvals screen on the existing endpoints, showing the selfie and the queue.
- **M6:**
  - background location
  - FCM push, including a collector notification feed
  - a proper no-show flow if pilots show it is needed
