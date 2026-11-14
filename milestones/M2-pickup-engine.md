# M2 Pickup engine

**Finished:** 2026-11-14 · **Status:** complete, all checks green

The API now runs the whole pickup: a household requests, nearby collectors are matched (1 km, then 3 km after 5 minutes), the first accept wins, the collector proves arrival with the household's 4-digit code, weighs with a scale photo, the household confirms or disputes, the collector pays, and every step is sent live over Socket.IO.

## Checklist

### Contract and schema
- [x] `docs/openapi.yaml` updated first: rules and error codes per endpoint, full `Pickup` shape (weigh rounds, photos, payment, open dispute, timestamps), `Dispute` outcomes, Idempotency-Key rules, Socket.IO event names and payloads (`SocketEvents`, `Event*`)
- [x] `itemPhotoIds` removed from `CreatePickup`; item photos are uploaded after the request is created
- [x] Types regenerated (`pnpm gen:api`); new constants in `@bw/shared` (slot hours, weight-band kg, outcomes per dispute type, event names, code attempts, online timeout)
- [x] Migration `1763193600000-PickupEngine`: `pickups.area`, `search_started_at`, `wallet_number`; `disputes.photo_ids`; one open dispute per pickup; one scale photo per weigh round; allowed outcomes; sweep indexes. Tested up, down, up

### Endpoints
- [x] `POST /pickups`: checks address, categories, published rates, bookable slot; expires at slot end
- [x] `GET /pickups/{id}`: household, assigned collector or admin only; exact address and phone hidden until accept
- [x] `GET /me/pickups`: newest first, ACTIVE / COMPLETED / CANCELLED filters, cursor paging
- [x] `POST /pickups/{id}/accept`: one atomic `UPDATE ... WHERE status = 'REQUESTED'`; loser gets ALREADY_TAKEN; rates copied to `rate_snapshot`; code created
- [x] `POST /pickups/{id}/release`: back to REQUESTED at 1 km, clears collector, code and copied rates, restarts the 5-minute clock
- [x] `POST /pickups/{id}/arrive`: HMAC-hashed code; CODE_MISMATCH with attempts left; 5th wrong code locks (CODE_LOCKED, 423) and alerts admins
- [x] `POST /pickups/{id}/photos`: presigned upload links (ITEMS for the household, SCALE for the collector or admin)
- [x] `POST /pickups/{id}/weights`: first weigh, re-weigh, or admin team weigh; versioned `weigh_lines`; server computes every amount in whole paisa; scale photo must be uploaded and unused
- [x] `POST /pickups/{id}/confirm`: payment method, wallet number for bKash / Nagad
- [x] `POST /pickups/{id}/dispute`: WEIGHT (1st REWEIGH, then ADMIN_REVIEW), PAYMENT (stays COMPLETED, payment REPORTED), BEHAVIOUR / OTHER
- [x] `POST /pickups/{id}/payment`: must match confirmed method; TrxID required for bKash / Nagad and used once; PAY_AGAIN flow
- [x] `POST /pickups/{id}/rating`: once, after completion; updates the collector's average
- [x] `POST /pickups/{id}/cancel` (household) and `POST /admin/pickups/{id}/cancel` (admin, any active status)
- [x] `GET /admin/disputes`, `POST /admin/disputes/{id}/resolve`: ACCEPT_WEIGHTS, TEAM_REWEIGH, CANCEL, PAYMENT_VERIFIED, PAY_AGAIN, SUSPEND_COLLECTOR, NO_ACTION
- [x] `PUT /collector/status`, `PUT /collector/location`, `GET /collector/requests/nearby` (approved collectors only)

### Engine
- [x] State machine from CLAUDE.md as one table (`pickups/state-machine.ts`); every status change goes through one helper that writes `status_events` in the same transaction
- [x] Matching jobs (`jobs/matching-jobs.service.ts`): widening and expiry swept every 15 s with conditional `UPDATE ... RETURNING` (safe with several API processes); `JOBS_ENABLED` switch
- [x] Socket.IO gateway: JWT on connect, a room per user plus `admins`; 15 events; `request.created` carries each collector's own distance and never the address
- [x] Idempotency-Key interceptor (Redis, 24 h, per user and URL) on create, accept, weights, confirm, payment
- [x] Photo storage: S3 client with presigned links; local S3 service in `docker-compose.yml`; bucket created on start in development

### Docs
- [x] CLAUDE.md: event list, M2 ticked, milestone-note rule; README: storage service and upgrade steps; `.env.example`: `S3_*`, `JOBS_ENABLED`

## Verification

| Check | Result |
| --- | --- |
| `pnpm turbo run lint typecheck test build --force` | 11/11 tasks; lint 0 warnings |
| Unit tests | 30 API + 4 shared pass (state machine table, slots, money, estimate, pickup code, env, presigned links) |
| `pnpm test:e2e` | 9 files, 87 tests pass |
| Migration | `db:migrate`, `migration:revert`, `db:migrate` all succeed on dev and test databases |
| Real-services smoke run | Built API + Postgres + Redis + SeaweedFS: sign-in, matching, accept, code, real photo upload and download, weights, bKash payment, live events received |
| Live job | A request aged 6 minutes was widened to 3 km by the running sweep within ~8 s |

E2E coverage, by file: `pickups` (create, idempotency, validation, visibility, listing), `matching` (nearby, five simultaneous accepts → 1 winner and 4 ALREADY_TAKEN, out of range, not approved, release, cancel), `jobs` (widening, expiry, release restarts the clock), `weighing` (code lock, scale photo rules, server-side totals, TrxID rules, rating, a table of refused moves per status), `disputes` (every outcome), `realtime` (real socket clients for every event).

## Decisions taken in M2

- UNDER_5 means "2 to 5 kg" on screen, so every band meets the 2 kg minimum. `BELOW_MINIMUM` is therefore never returned today; it is kept in the contract in case the bands change.
- TEAM_REWEIGH closes the dispute and leaves the pickup DISPUTED until an admin posts weights.
- PAY_AGAIN keeps the payment REPORTED until the collector records a new, different TrxID.
- Weigh lines may only use the request's categories, each once.
- No admin unlock for a locked pickup code; admins cancel instead.
- ACCEPTED pickups do not expire at slot end (state machine); they surface for admins in M5.
- **Local storage is SeaweedFS, not MinIO:** MinIO no longer publishes container images (none on Docker Hub or quay.io). The API speaks plain S3, so production can use S3, R2 or any compatible service.
- AWS SDK default checksums are turned off for presigned URLs (they made every real upload fail with BadDigest; found by the smoke run, covered by a unit test).

## Open items for later milestones

- M4: collector sign-up and profile endpoints (tests create collector profiles with SQL for now), `/collector/ledger`.
- M5: `GET /admin/pickups`, a "needs attention" view for locked codes and accepted-but-late pickups.
- M6: Socket.IO Redis adapter for more than one API instance (each process only reaches its own sockets today), FCM push for events while the app is closed, alerts for code locks and payment reports.
- Item photos are listed as soon as an upload slot is issued, even if the upload never finishes; only scale photos are checked for existence.
