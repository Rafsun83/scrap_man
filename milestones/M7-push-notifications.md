# M7 Push notifications (Firebase Cloud Messaging)

**Built:** 2026-11-21 (commit `e8ce920`) · **Status:** code done and checked; **the real-phone test is still pending.** This is the first M7 item. The rest of M7 (SMS provider, alert destination, hosting, Play release, walk-throughs, content) is still open.

M6 had built device registration, push text in each user's language, and a push for every pickup event, but sent them to a console sender. This step adds:
- **The API** sends real pushes through Firebase Cloud Messaging when `PUSH_PROVIDER=fcm`.
- **The Android app** has the Firebase config and a notification channel. Push turns on in the build.
- **The app's package** is now `com.bhangariwala` (it was `com.bhangariwala.app`).

## Checklist

### Firebase (done by Rafsun)
- [x] A Firebase project (`bhangariwala-bdd67`) under a **personal** Google account. Under the work account, the organization policy `iam.disableServiceAccountKeyCreation` blocked service-account keys.
- [x] An Android app registered as `com.bhangariwala`; `google-services.json` saved at `apps/mobile/google-services.json` (gitignored).
- [x] A service-account key for the API, kept outside the repo.

### Contract
- [x] No change: `PUT /me/devices`, `DELETE /me/devices/{token}` and the push payloads were already in `docs/openapi.yaml` (M6).

### API (`apps/api`, to the backend standard)
- [x] `firebase-admin` **14.5.0**, pinned exactly (14.5.1 was younger than 14 days).
- [x] `FcmPushSender` (`src/modules/push/services/fcm-push-sender.service.ts`), behind the existing `PushSender` interface:
  - one `sendEach` call per 500 messages; a batch that fails is logged and the next batch still goes
  - a high-priority notification on Android channel `default`, with the `data` the app uses to open the right screen
  - tokens FCM calls dead (`registration-token-not-registered`, `invalid-registration-token`) are returned, so `PushService` deletes them
  - other per-token errors are logged with the token shortened
  - iOS tokens are skipped, not deleted: the app registers an APNs token on iPhone, which FCM cannot address
- [x] `push.module.ts` picks the sender with a factory on `PUSH_PROVIDER`, like the SMS module.
- [x] Settings in `src/config/env.ts`:
  - `PUSH_PROVIDER`: `console` by default in development and test, `fcm` by default in production (console there must be explicit)
  - credentials, any one of: `GOOGLE_APPLICATION_CREDENTIALS` (path to the key file), `FCM_SERVICE_ACCOUNT_JSON` (the key on one line), or `FCM_PROJECT_ID` for keyless sign-in (gcloud impersonation, or an attached service account)
  - `fcm` without any of them stops the API at startup with a message naming the settings
  - a key that is not JSON, or is missing `project_id`, `client_email` or `private_key`, is refused; the message never prints the key
  - a key Firebase cannot read (for example a broken private key) stops startup with "Firebase refused the key in …"

### Mobile (`apps/mobile`)
- [x] `app.json`: Android `package` and iOS `bundleIdentifier` changed to `com.bhangariwala` to match the Firebase app. Nothing was on Google Play yet, so the change was free.
- [x] `apps/mobile/.env.local` sets `GOOGLE_SERVICES_JSON=./google-services.json`; `app.config.ts` then adds the file to the build and sets `pushEnabled`.
- [x] `src/push/registration.ts` creates the Android channel `default` (high importance, sound) before asking for permission, so Android 13 shows the prompt. The channel id matches the API.

### Settings, deployment and safety
- [x] `.env.example`: `PUSH_PROVIDER=console` with the local FCM instructions; the production section has `PUSH_PROVIDER=fcm` and `FCM_SERVICE_ACCOUNT_JSON` (one line: `jq -c . key.json`).
- [x] `apps/mobile/.env.example`: `GOOGLE_SERVICES_JSON`, and a note that Expo Go cannot receive these pushes.
- [x] `docker-compose.prod.yml` passes `PUSH_PROVIDER` (default `fcm`), `FCM_SERVICE_ACCOUNT_JSON` and `FCM_PROJECT_ID` to the API.
- [x] `docker/smoke.env` sets `PUSH_PROVIDER=console`, so the smoke stack needs no Firebase.
- [x] `.gitignore` covers `google-services.json`, `GoogleService-Info.plist` and `*firebase-adminsdk*.json`. Checked after the commit: none of them is tracked.

## Verification

| Check | Result |
| --- | --- |
| `pnpm turbo run lint typecheck test build` | 17/17 tasks; lint 0 warnings |
| API unit | 41 pass (6 new: FCM sender 4, settings 2) |
| Shared, admin, landing, mobile | 19, 28 and 8 pass; mobile lint, typecheck and tests pass |
| `pnpm test:e2e` | 17 files, **140 tests** pass (they keep the fake sender) |
| FCM sender tests | message shape (priority, channel, data); only dead tokens deleted; iOS skipped; batches of 500; a failed batch does not stop the next |
| Broken key at startup | `FcmPushSender.create` with a bad private key fails fast with a message naming `FCM_SERVICE_ACCOUNT_JSON` |
| Resolved Expo config | `package` and `bundleIdentifier` `com.bhangariwala`, `googleServicesFile ./google-services.json`, `pushEnabled true` |
| **On a phone** | **Not run yet** |

## Still to do

### Phone test
- [ ] In `apps/api/.env`, set `PUSH_PROVIDER=fcm` and `GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/key.json`, then `pnpm dev`. The API starts without a Firebase error.
- [ ] Make a development build on a USB-connected phone: `cd apps/mobile && npx expo run:android`. Expo Go cannot receive FCM pushes.
- [ ] Sign in as a household and allow notifications. A row appears in `push_devices` with platform `ANDROID`.
- [ ] With the app in the background, accept the request as a collector. A Bangla banner arrives, and tapping it opens the pickup.
- [ ] Do the same for a collector push (new request nearby, household confirmed).
- [ ] Uninstall the app and trigger another event. The token row is deleted.
- [ ] Then tick push in the M7 lists in `CLAUDE.md` and `README.md`.

### Later
- [ ] Production: put the key in the host's secret store as `FCM_SERVICE_ACCOUNT_JSON`, or use keyless credentials if the host is Google Cloud.
- [ ] EAS builds need `google-services.json` as an EAS file secret, because the file is not in git.
- [ ] iOS (not in v1): an APNs key uploaded to Firebase, an iOS app in Firebase, and FCM tokens on iPhone instead of APNs tokens.

## Decisions

- **Personal Google account for Firebase,** not the work organization: its policy blocks key creation, and the product should not depend on an employer's cloud.
- **The app's package became `com.bhangariwala`** to match the Firebase app that was already registered, rather than registering a second Firebase app. Rafsun chose this; the package cannot change after the Play listing.
- **Google's standard credentials lookup** (`applicationDefault`) when no key is pasted in, so a key file, gcloud impersonation and a cloud-attached service account all work with no code change.
- **FCM notification messages** (not data-only), so Android shows them even when the app is closed; the app opens the screen from `data` when tapped.
- **Production defaults to FCM** and refuses to start without credentials, like SMS. The smoke stack opts out with `PUSH_PROVIDER=console`.
