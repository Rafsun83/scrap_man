# BhangariWala API reference

Every endpoint the API serves today (milestones M0 to M4), what it is for, who may call it, and a real request and response for each. The machine-readable contract is [`openapi.yaml`](openapi.yaml); when this page and the contract disagree, the contract wins.

> **How the samples were made:** the M4 samples (collector sign-up, approval, profile, ledger, `lockedRates`, an item added at weighing, the new nearby fields) come from a scripted collector journey on 2026-11-16. The M3 samples (summary, notifications, `collectorLocation`, `rating`) come from a second scripted sale on 2026-11-15. Every other sample below was recorded from the real API (PostgreSQL, Redis and S3 storage) on 2026-11-14 by one scripted run: a household in Mirpur 10, two approved collectors 200-300 m away, and the seeded admin. Tokens and presigned link signatures are shortened; everything else is exactly what the server returned. Phone numbers are test numbers.

## Contents

- [Basics](#basics): base URL, sign-in, headers, errors, formats
- [A pickup from start to finish](#a-pickup-from-start-to-finish)
- [Endpoint index](#endpoint-index)
- [Health](#health)
- [Auth](#auth)
- [Catalog](#catalog)
- [Profile and addresses](#profile-and-addresses)
- [Pickups](#pickups)
- [Collector](#collector)
- [Admin](#admin)
- [Notifications](#notifications)
- [Live events (Socket.IO)](#live-events-socketio)
- [Planned endpoints](#planned-endpoints)

## Basics

| | |
| --- | --- |
| Base URL | `http://localhost:3000/api/v1` in development; every path below starts here |
| Format | JSON in and out (`Content-Type: application/json`) |
| Sign-in | `Authorization: Bearer <accessToken>` on every endpoint not marked Public. Get tokens from [POST /auth/otp/verify](#post-authotpverify); the access token lasts 15 minutes, then use [POST /auth/refresh](#post-authrefresh) |
| Roles | `HOUSEHOLD`, `COLLECTOR`, `ADMIN`. A number keeps the role it signed up with. Calling an endpoint for another role returns `403 FORBIDDEN` |
| Idempotency-Key | Required on create pickup, accept, weights, confirm and payment. Send a new random value (up to 64 letters, digits, `-` or `_`) per action and reuse it when retrying: the API returns the first response for 24 hours instead of doing the work twice |
| IDs | UUIDs. Pickups also have a short `displayNo` like `BW-1004` for people |
| Money | Taka, up to 2 decimals (`625`, `18.5`). The server computes every amount; apps never send one, except a collector's quote for electronics |
| Weight | kg to 0.1 (`9.5`) |
| Time | Timestamps in UTC ISO 8601; dates (`slotDate`, `effectiveDate`) are Dhaka-time days `YYYY-MM-DD` |
| Digits and words | ASCII digits and English enum values only. Bangla digits and words are for display (`toBanglaDigits`, `formatTaka` in `@bw/shared`) |
| Location | `{ "lat": 23.8069, "lng": 90.3687 }`, inside Bangladesh |

### Errors

Every error has the same shape. `message` is plain English that says what happened and what to do; `details` is optional.

```json
{
  "code": "ALREADY_TAKEN",
  "message": "Another collector accepted this request first. Pick another one."
}
```

| Code | HTTP | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | A field is missing or wrong; `details.issues` lists each field |
| `UNAUTHORIZED` | 401 | Missing or expired access token, or bad refresh token: sign in or refresh |
| `OTP_INVALID` | 401 | Wrong, expired or used sign-in code |
| `FORBIDDEN` | 403 | Wrong role, or the account is suspended |
| `NOT_APPROVED` | 403 | Collector not approved yet |
| `NOT_FOUND` | 404 | Unknown id, or something the user may not see |
| `ALREADY_TAKEN` | 409 | Another collector accepted the request first |
| `INVALID_STATE` | 409 | Not allowed in the pickup's current status; `details.status` says which. Also a repeat while the first call with that Idempotency-Key is still running |
| `TRX_ID_REUSED` | 409 | This bKash or Nagad TrxID was already used |
| `BELOW_MINIMUM` | 422 | Reserved for the 2 kg minimum; not returned today because every weight band starts at 2 kg |
| `OUT_OF_RANGE` | 422 | The collector is too far from the request, offline, or has no recent location |
| `CODE_MISMATCH` | 422 | Wrong pickup code; `details.attemptsLeft` |
| `SCALE_PHOTO_REQUIRED` | 422 | Weights sent without a usable, uploaded scale photo |
| `TRX_ID_REQUIRED` | 422 | bKash or Nagad payment without a TrxID |
| `CODE_LOCKED` | 423 | Five wrong pickup codes; an admin must step in |
| `OTP_RATE_LIMIT` | 429 | Too many sign-in codes requested |

A validation error names each wrong field:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Some fields are missing or not valid.",
  "details": {
    "issues": [
      {
        "path": "location.lat",
        "message": "Too big: expected number to be <=26.7"
      },
      {
        "path": "location.lng",
        "message": "Too small: expected number to be >=88"
      }
    ]
  }
}
```

## A pickup from start to finish

| Step | Who | Call | Status after |
| --- | --- | --- | --- |
| 1 | Household | [POST /pickups](#post-pickups) | REQUESTED (collectors within 1 km get `request.created`; 3 km after 5 minutes) |
| 2 | Collector | [GET /collector/requests/nearby](#get-collectorrequestsnearby), then [POST …/accept](#post-pickupspickupidaccept) | ACCEPTED (household sees the 4-digit code) |
| 3 | Collector | [POST …/arrive](#post-pickupspickupidarrive) with the code | ARRIVED |
| 4 | Collector | [POST …/photos](#post-pickupspickupidphotos) (SCALE), upload, then [POST …/weights](#post-pickupspickupidweights) | WEIGHED |
| 5 | Household | [POST …/confirm](#post-pickupspickupidconfirm), or [POST …/dispute](#post-pickupspickupiddispute) type WEIGHT | CONFIRMED, or DISPUTED |
| 6 | Collector | [POST …/payment](#post-pickupspickupidpayment) | COMPLETED |
| 7 | Household | [POST …/rating](#post-pickupspickupidrating) | COMPLETED |

Other paths: the collector can [release](#post-pickupspickupidrelease) before arriving (back to REQUESTED); the household can [cancel](#post-pickupspickupidcancel) before arrival; an unaccepted request EXPIRES at the end of its slot; admins [cancel](#post-adminpickupspickupidcancel) and [resolve disputes](#post-admindisputesdisputeidresolve). Any other move returns `409 INVALID_STATE`.

## Endpoint index

| Method | Path | Who | Purpose | Since |
| --- | --- | --- | --- | --- |
| `GET` | [`/health`](#get-health) | Public | Says whether the API, PostgreSQL and Redis are answering | M0 |
| `POST` | [`/auth/otp/request`](#post-authotprequest) | Public | Sends a 6-digit sign-in code to a phone number by SMS | M1 |
| `POST` | [`/auth/otp/verify`](#post-authotpverify) | Public | Checks the code and signs in | M1 |
| `POST` | [`/auth/refresh`](#post-authrefresh) | Public (refresh token) | Swaps a refresh token for a new access and refresh token pair | M1 |
| `POST` | [`/auth/logout`](#post-authlogout) | Public (refresh token) | Ends a session by revoking its refresh token | M1 |
| `GET` | [`/categories`](#get-categories) | Public | The active scrap categories in display order, with Bangla and English names | M1 |
| `GET` | [`/rates/today`](#get-ratestoday) | Public | Today's per-kg rate for every category and the change from the previous published rate (home screen rate board) | M1 |
| `PUT` | [`/admin/rates`](#put-adminrates) | Admin | Publishes, or corrects, the per-kg rates for today or a later date | M1 |
| `GET` | [`/me`](#get-me) | Any signed-in user | The signed-in user | M1 |
| `PATCH` | [`/me`](#patch-me) | Any signed-in user | Changes the name or the app language (`BN` or `EN`) | M1 |
| `GET` | [`/me/addresses`](#get-meaddresses) | Household | Saved addresses, default first | M1 |
| `POST` | [`/me/addresses`](#post-meaddresses) | Household | Saves an address with its map location | M1 |
| `PATCH` | [`/me/addresses/{addressId}`](#patch-meaddressesaddressid) | Household | Edits any field of an address | M1 |
| `DELETE` | [`/me/addresses/{addressId}`](#delete-meaddressesaddressid) | Household | Removes an address | M1 |
| `POST` | [`/pickups`](#post-pickups) | Household | Requests a doorstep pickup | M2 |
| `GET` | [`/pickups/{pickupId}`](#get-pickupspickupid) | The household, the assigned collector, or an admin | One pickup, shaped for the viewer | M2 |
| `GET` | [`/me/pickups`](#get-mepickups) | Household or collector | Own pickups, newest first: the household's requests, or the collector's assigned pickups (history screens H11 and C8); `PAST` filter since M4 | M2 |
| `GET` | [`/me/summary`](#get-mesummary) | Household | Totals for the history screen: completed pickups, kg sold, taka earned (H11) | M3 |
| `POST` | [`/pickups/{pickupId}/cancel`](#post-pickupspickupidcancel) | Household (own pickup) | The household cancels before the collector arrives | M2 |
| `POST` | [`/pickups/{pickupId}/accept`](#post-pickupspickupidaccept) | Collector (approved, online) | Claims a request | M2 |
| `POST` | [`/pickups/{pickupId}/release`](#post-pickupspickupidrelease) | Assigned collector | Gives an accepted request back before arriving | M2 |
| `POST` | [`/pickups/{pickupId}/arrive`](#post-pickupspickupidarrive) | Assigned collector | The collector enters the household's 4-digit code at the door (status `ARRIVED`) | M2 |
| `POST` | [`/pickups/{pickupId}/photos`](#post-pickupspickupidphotos) | Household (ITEMS), collector or admin (SCALE) | Gets a presigned link to upload a photo straight to storage | M2 |
| `POST` | [`/pickups/{pickupId}/weights`](#post-pickupspickupidweights) | Assigned collector, or admin after TEAM_REWEIGH | Sends a weigh round; since M4 may add items found at the door | M2 |
| `POST` | [`/pickups/{pickupId}/confirm`](#post-pickupspickupidconfirm) | Household | The household approves the weights and chooses how to be paid (status `CONFIRMED`) | M2 |
| `POST` | [`/pickups/{pickupId}/dispute`](#post-pickupspickupiddispute) | Household | The household rejects the weights or reports a problem | M2 |
| `POST` | [`/pickups/{pickupId}/payment`](#post-pickupspickupidpayment) | Assigned collector | The collector records the payment (status `COMPLETED`) | M2 |
| `POST` | [`/pickups/{pickupId}/rating`](#post-pickupspickupidrating) | Household | Rates the collector 1 to 5 stars after a completed pickup; updates the collector's average | M2 |
| `POST` | [`/collector/selfie`](#post-collectorselfie) | Collector | Gets a presigned link to upload the sign-up selfie (C6) | M4 |
| `POST` | [`/collector/signup`](#post-collectorsignup) | Collector | Submits the collector application (C6); applying again after a rejection | M4 |
| `GET` | [`/collector/profile`](#get-collectorprofile) | Collector | Own profile, verification status and note, rating, 30-day activity (C7, C11) | M4 |
| `PATCH` | [`/collector/profile`](#patch-collectorprofile) | Collector | Changes work areas, vehicle or scale | M4 |
| `GET` | [`/collector/ledger`](#get-collectorledger) | Collector | Payouts, kg and pickups for a date range, by method and item, with each payment (C1, C9) | M4 |
| `PUT` | [`/collector/status`](#put-collectorstatus) | Approved collector | Goes online (with a location) or offline | M2 |
| `PUT` | [`/collector/location`](#put-collectorlocation) | Approved collector | Location ping, about every 30 seconds while online or on the way | M2 |
| `GET` | [`/collector/requests/nearby`](#get-collectorrequestsnearby) | Approved collector | Open requests whose current radius reaches the given point, nearest first (screen C1) | M2 |
| `GET` | [`/admin/collectors`](#get-admincollectors) | Admin | Collector applications by verification status, oldest first | M4 |
| `POST` | [`/admin/collectors/{userId}/decision`](#post-admincollectorsuseriddecision) | Admin | Approves or rejects a pending application; SMS and live event to the collector | M4 |
| `POST` | [`/admin/pickups/{pickupId}/cancel`](#post-adminpickupspickupidcancel) | Admin | Cancels any active pickup (REQUESTED to CONFIRMED), with a reason | M2 |
| `GET` | [`/admin/disputes`](#get-admindisputes) | Admin | Disputes, open first (screen A4) | M2 |
| `POST` | [`/admin/disputes/{disputeId}/resolve`](#post-admindisputesdisputeidresolve) | Admin | Closes a dispute in `ADMIN_REVIEW` with an outcome | M2 |
| `GET` | [`/me/notifications`](#get-menotifications) | Household | The household's notifications, newest first, with the unread count (H13) | M3 |
| `POST` | [`/me/notifications/read`](#post-menotificationsread) | Household | Marks every notification up to now as read | M3 |

## Health

### GET /health

Says whether the API, PostgreSQL and Redis are answering. Used by the admin panel, the mobile start screen and uptime checks.

**Who:** Public · **Since:** M0

- `200` when both checks pass; `503` with the same body when the database or Redis is down.

**Request**

```http
GET /api/v1/health
```

**Response**

`200`

```json
{
  "status": "ok",
  "checks": {
    "database": "up",
    "redis": "up"
  },
  "time": "2026-11-14T11:40:08.664Z"
}
```

## Auth

### POST /auth/otp/request

Sends a 6-digit sign-in code to a phone number by SMS.

**Who:** Public · **Since:** M1

- Phone format `+8801[3-9]XXXXXXXX`.
- Limits: 3 codes per number and 10 per IP address in 10 minutes.
- In development every code is `123456` (`OTP_DEV_CODE`) and the SMS is printed in the API log.

**Request**

```http
POST /api/v1/auth/otp/request
```

```json
{
  "phone": "+8801916408620"
}
```

**Response**

`204` with no body.

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Phone number is not a Bangladesh mobile number |
| `OTP_RATE_LIMIT` | 429 | Too many codes for this number or IP |

### POST /auth/otp/verify

Checks the code and signs in. A new number signs up with the role sent; an existing number keeps the role it signed up with (check `user.role`).

**Who:** Public · **Since:** M1

- Codes expire after 5 minutes, work once, and are discarded after 5 wrong tries.
- Returns a 15-minute access token (JWT) and a 30-day refresh token.

**Request**

```http
POST /api/v1/auth/otp/verify
```

```json
{
  "phone": "+8801916408620",
  "code": "123456",
  "role": "HOUSEHOLD"
}
```

**Response**

`200`

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5…",
  "refreshToken": "tiS26u6N3u…",
  "expiresIn": 900,
  "user": {
    "id": "68aca7b0-6e76-400a-989a-92376f21cc50",
    "phone": "+8801916408620",
    "role": "HOUSEHOLD",
    "name": null,
    "language": "BN",
    "status": "ACTIVE",
    "createdAt": "2026-11-14T11:40:08.718Z"
  }
}
```

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `OTP_INVALID` | 401 | Wrong, expired or used code |
| `FORBIDDEN` | 403 | The account is suspended |

<details><summary>Example: Code already used</summary>

```http
POST /api/v1/auth/otp/verify
```

```json
{
  "phone": "+8801916408620",
  "code": "000000",
  "role": "HOUSEHOLD"
}
```

`401`

```json
{
  "code": "OTP_INVALID",
  "message": "The code has expired. Request a new one.",
  "details": {
    "attemptsLeft": 0
  }
}
```

</details>

### POST /auth/refresh

Swaps a refresh token for a new access and refresh token pair.

**Who:** Public (refresh token) · **Since:** M1

- Each refresh token works once; keep the new one.

**Request**

```http
POST /api/v1/auth/refresh
```

```json
{
  "refreshToken": "tiS26u6N3u…"
}
```

**Response**

`200`

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5…",
  "refreshToken": "23AR7EML8T…",
  "expiresIn": 900,
  "user": {
    "id": "68aca7b0-6e76-400a-989a-92376f21cc50",
    "phone": "+8801916408620",
    "role": "HOUSEHOLD",
    "name": null,
    "language": "BN",
    "status": "ACTIVE",
    "createdAt": "2026-11-14T11:40:08.718Z"
  }
}
```

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | Unknown, used or expired refresh token |
| `FORBIDDEN` | 403 | The account is suspended |

### POST /auth/logout

Ends a session by revoking its refresh token. The access token runs out on its own within 15 minutes.

**Who:** Public (refresh token) · **Since:** M1

**Request**

```http
POST /api/v1/auth/logout
```

```json
{
  "refreshToken": "23AR7EML8T…"
}
```

**Response**

`204` with no body.

## Catalog

### GET /categories

The active scrap categories in display order, with Bangla and English names.

**Who:** Public · **Since:** M1

- `ON_INSPECTION` categories (electronics) have no daily rate; the collector quotes an amount at the door.

**Request**

```http
GET /api/v1/categories
```

**Response**

`200`

```json
[
  {
    "code": "IRON",
    "nameBn": "লোহা",
    "nameEn": "Iron",
    "pricingType": "PER_KG",
    "icon": "iron"
  },
  {
    "code": "NEWSPAPER",
    "nameBn": "পুরোনো পত্রিকা",
    "nameEn": "Old newspaper",
    "pricingType": "PER_KG",
    "icon": "newspaper"
  },
  {
    "code": "PLASTIC",
    "nameBn": "প্লাস্টিক",
    "nameEn": "Plastic",
    "pricingType": "PER_KG",
    "icon": "bottle"
  },
  {
    "code": "CARTON",
    "nameBn": "কার্টন",
    "nameEn": "Carton",
    "pricingType": "PER_KG",
    "icon": "carton"
  },
  {
    "code": "ALUMINIUM",
    "nameBn": "অ্যালুমিনিয়াম",
    "nameEn": "Aluminium",
    "pricingType": "PER_KG",
    "icon": "can"
  },
  {
    "code": "ELECTRONICS",
    "nameBn": "ইলেকট্রনিক্স",
    "nameEn": "Electronics",
    "pricingType": "ON_INSPECTION",
    "icon": "device"
  }
]
```

### GET /rates/today

Today's per-kg rate for every category and the change from the previous published rate (home screen rate board).

**Who:** Public · **Since:** M1

- Uses the latest rate published on or before today (Dhaka time).
- `ratePerKg` is `null` for electronics and for categories never priced.

**Request**

```http
GET /api/v1/rates/today
```

**Response**

`200`

```json
{
  "effectiveDate": "2026-11-14",
  "publishedAt": "2026-11-14T11:40:08.782Z",
  "rates": [
    {
      "categoryCode": "IRON",
      "ratePerKg": 50,
      "changeFromYesterday": null
    },
    {
      "categoryCode": "NEWSPAPER",
      "ratePerKg": 30,
      "changeFromYesterday": null
    },
    {
      "categoryCode": "PLASTIC",
      "ratePerKg": 35,
      "changeFromYesterday": null
    },
    {
      "categoryCode": "CARTON",
      "ratePerKg": 18,
      "changeFromYesterday": null
    },
    {
      "categoryCode": "ALUMINIUM",
      "ratePerKg": 160,
      "changeFromYesterday": null
    },
    {
      "categoryCode": "ELECTRONICS",
      "ratePerKg": null,
      "changeFromYesterday": null
    }
  ]
}
```

### PUT /admin/rates

Publishes, or corrects, the per-kg rates for today or a later date.

**Who:** Admin · **Since:** M1

- Past dates, unknown categories, duplicates and electronics are refused.
- Pickups already accepted keep the rate copied at accept.

**Request**

```http
PUT /api/v1/admin/rates
Authorization: Bearer <accessToken>
```

```json
{
  "effectiveDate": "2026-11-14",
  "rates": [
    {
      "categoryCode": "IRON",
      "ratePerKg": 50
    },
    {
      "categoryCode": "NEWSPAPER",
      "ratePerKg": 30
    },
    {
      "categoryCode": "PLASTIC",
      "ratePerKg": 35
    },
    {
      "categoryCode": "CARTON",
      "ratePerKg": 18
    },
    {
      "categoryCode": "ALUMINIUM",
      "ratePerKg": 160
    }
  ]
}
```

**Response**

`204` with no body.

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Past date, unknown or duplicate category, electronics |
| `FORBIDDEN` | 403 | Not an admin |

<details><summary>Example: Not an admin</summary>

```http
PUT /api/v1/admin/rates
Authorization: Bearer <accessToken>
```

```json
{
  "effectiveDate": "2026-11-14",
  "rates": [
    {
      "categoryCode": "IRON",
      "ratePerKg": 50
    }
  ]
}
```

`403`

```json
{
  "code": "FORBIDDEN",
  "message": "Your account type cannot do this."
}
```

</details>

## Profile and addresses

### GET /me

The signed-in user.

**Who:** Any signed-in user · **Since:** M1

**Request**

```http
GET /api/v1/me
Authorization: Bearer <accessToken>
```

**Response**

`200`

```json
{
  "id": "68aca7b0-6e76-400a-989a-92376f21cc50",
  "phone": "+8801916408620",
  "role": "HOUSEHOLD",
  "name": null,
  "language": "BN",
  "status": "ACTIVE",
  "createdAt": "2026-11-14T11:40:08.718Z"
}
```

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | Missing or expired access token |

<details><summary>Example: No token</summary>

```http
GET /api/v1/me
```

`401`

```json
{
  "code": "UNAUTHORIZED",
  "message": "Sign in again: the access token is missing or expired."
}
```

</details>

### PATCH /me

Changes the name or the app language (`BN` or `EN`).

**Who:** Any signed-in user · **Since:** M1

- Send at least one field.

**Request**

```http
PATCH /api/v1/me
Authorization: Bearer <accessToken>
```

```json
{
  "name": "Morium Khatun",
  "language": "BN"
}
```

**Response**

`200`

```json
{
  "id": "68aca7b0-6e76-400a-989a-92376f21cc50",
  "phone": "+8801916408620",
  "role": "HOUSEHOLD",
  "name": "Morium Khatun",
  "language": "BN",
  "status": "ACTIVE",
  "createdAt": "2026-11-14T11:40:08.718Z"
}
```

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Empty body or wrong values |

### GET /me/addresses

Saved addresses, default first.

**Who:** Household · **Since:** M1

**Request**

```http
GET /api/v1/me/addresses
Authorization: Bearer <accessToken>
```

**Response**

`200`

```json
[
  {
    "id": "999a2e02-5341-47f6-acb4-0feffb4584e3",
    "label": "বাসা",
    "line": "House 12, Road 4, Block C",
    "area": "Mirpur 10",
    "city": "Dhaka",
    "location": {
      "lat": 23.8069,
      "lng": 90.3687
    },
    "note": "3rd floor",
    "isDefault": true
  },
  {
    "id": "ea21b714-1c25-44d2-9dc8-7bc8cd045148",
    "label": "Office",
    "line": "Plot 7, Sector 3",
    "area": "Uttara",
    "city": "Dhaka",
    "location": {
      "lat": 23.8759,
      "lng": 90.3795
    },
    "note": "Ask the guard",
    "isDefault": false
  }
]
```

### POST /me/addresses

Saves an address with its map location. Pickups are requested for a saved address.

**Who:** Household · **Since:** M1

- Up to 10 addresses. The first one is the default; `isDefault: true` moves the default.
- Location must be inside Bangladesh (a guard against swapped lat/lng).

**Request**

```http
POST /api/v1/me/addresses
Authorization: Bearer <accessToken>
```

```json
{
  "label": "বাসা",
  "line": "House 12, Road 4, Block C",
  "area": "Mirpur 10",
  "location": {
    "lat": 23.8069,
    "lng": 90.3687
  },
  "note": "3rd floor",
  "isDefault": true
}
```

**Response**

`201`

```json
{
  "id": "999a2e02-5341-47f6-acb4-0feffb4584e3",
  "label": "বাসা",
  "line": "House 12, Road 4, Block C",
  "area": "Mirpur 10",
  "city": "Dhaka",
  "location": {
    "lat": 23.8069,
    "lng": 90.3687
  },
  "note": "3rd floor",
  "isDefault": true
}
```

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Missing fields, location outside Bangladesh, more than 10 addresses |

<details><summary>Example: Location outside Bangladesh</summary>

```http
POST /api/v1/me/addresses
Authorization: Bearer <accessToken>
```

```json
{
  "label": "X",
  "line": "Y",
  "area": "Z",
  "location": {
    "lat": 51.5,
    "lng": -0.1
  }
}
```

`400`

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Some fields are missing or not valid.",
  "details": {
    "issues": [
      {
        "path": "location.lat",
        "message": "Too big: expected number to be <=26.7"
      },
      {
        "path": "location.lng",
        "message": "Too small: expected number to be >=88"
      }
    ]
  }
}
```

</details>

### PATCH /me/addresses/{addressId}

Edits any field of an address.

**Who:** Household · **Since:** M1

- Existing pickups keep the address text they were created with.

**Request**

```http
PATCH /api/v1/me/addresses/ea21b714-1c25-44d2-9dc8-7bc8cd045148
Authorization: Bearer <accessToken>
```

```json
{
  "note": "Ask the guard"
}
```

**Response**

`200`

```json
{
  "id": "ea21b714-1c25-44d2-9dc8-7bc8cd045148",
  "label": "Office",
  "line": "Plot 7, Sector 3",
  "area": "Uttara",
  "city": "Dhaka",
  "location": {
    "lat": 23.8759,
    "lng": 90.3795
  },
  "note": "Ask the guard",
  "isDefault": false
}
```

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `NOT_FOUND` | 404 | Not one of the user's addresses |

### DELETE /me/addresses/{addressId}

Removes an address.

**Who:** Household · **Since:** M1

- Removing the default makes the newest remaining address the default.

**Request**

```http
DELETE /api/v1/me/addresses/ea21b714-1c25-44d2-9dc8-7bc8cd045148
Authorization: Bearer <accessToken>
```

**Response**

`204` with no body.

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `NOT_FOUND` | 404 | Not one of the user's addresses |

## Pickups

### POST /pickups

Requests a doorstep pickup. Online, approved collectors within 1 km get `request.created` straight away.

**Who:** Household · **Since:** M2 · **Idempotency-Key:** required

- The address must be one of the household's saved addresses.
- Categories must be active, and every per-kg category needs a published rate today.
- `slotDate` is today, tomorrow or the day after (Dhaka time) and the slot must not have ended. The request expires at the end of the slot (MORNING 9-12, MIDDAY 12-3, AFTERNOON 3-6).
- Weight bands start at 2 kg (`UNDER_5` means 2 to 5 kg), which meets the 2 kg minimum.
- `estimate` is the band's kg range times the average rate of the chosen per-kg categories; `null` for electronics only.
- Item photos are added afterwards with [POST /pickups/{pickupId}/photos](#post-pickupspickupidphotos).

**Request**

```http
POST /api/v1/pickups
Authorization: Bearer <accessToken>
Idempotency-Key: 6f1d2c3a-…
```

```json
{
  "addressId": "999a2e02-5341-47f6-acb4-0feffb4584e3",
  "categoryCodes": [
    "IRON",
    "NEWSPAPER",
    "ELECTRONICS"
  ],
  "weightBand": "FROM_5_TO_15",
  "slotDate": "2026-11-15",
  "slot": "MORNING",
  "note": "Ring the bell twice"
}
```

**Response**

`201`

```json
{
  "id": "7d5454fd-9794-4bdb-bea8-d34ac7b7e83f",
  "displayNo": "BW-1004",
  "status": "REQUESTED",
  "slotDate": "2026-11-15",
  "slot": "MORNING",
  "weightBand": "FROM_5_TO_15",
  "categoryCodes": [
    "IRON",
    "NEWSPAPER",
    "ELECTRONICS"
  ],
  "area": "Mirpur 10",
  "estimate": {
    "min": 200,
    "max": 600
  },
  "address": {
    "text": "House 12, Road 4, Block C, Mirpur 10, Dhaka",
    "lat": 23.8069,
    "lng": 90.3687,
    "note": "Ring the bell twice"
  },
  "household": {
    "id": "68aca7b0-6e76-400a-989a-92376f21cc50",
    "name": "Morium Khatun",
    "phone": null
  },
  "collector": null,
  "pickupCode": null,
  "codeLocked": false,
  "lines": [],
  "weighVersion": null,
  "weighRounds": [],
  "photos": [],
  "totalKg": null,
  "totalAmount": null,
  "paymentMethod": null,
  "walletNumber": null,
  "payment": null,
  "openDispute": null,
  "searchRadiusM": 1000,
  "requestedAt": "2026-11-14T11:40:10.232Z",
  "acceptedAt": null,
  "arrivedAt": null,
  "weighedAt": null,
  "confirmedAt": null,
  "completedAt": null,
  "cancelledAt": null,
  "expiresAt": "2026-11-15T06:00:00.000Z"
}
```

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Unknown category, rate not published, slot ended or too far ahead, missing Idempotency-Key |
| `NOT_FOUND` | 404 | Address is not the household's |
| `FORBIDDEN` | 403 | Not a household |

<details><summary>Example: Unknown category</summary>

```http
POST /api/v1/pickups
Authorization: Bearer <accessToken>
Idempotency-Key: 6f1d2c3a-…
```

```json
{
  "addressId": "999a2e02-5341-47f6-acb4-0feffb4584e3",
  "categoryCodes": [
    "GOLD"
  ],
  "weightBand": "UNDER_5",
  "slotDate": "2026-11-15",
  "slot": "MORNING"
}
```

`400`

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Unknown categories: GOLD.",
  "details": {
    "categoryCodes": [
      "GOLD"
    ]
  }
}
```

</details>

### GET /pickups/{pickupId}

One pickup, shaped for the viewer. This is the full `Pickup` shape every pickup endpoint returns.

**Who:** The household, the assigned collector, or an admin · **Since:** M2

- Anyone else gets `404`. Collectors browsing open requests use [GET /collector/requests/nearby](#get-collectorrequestsnearby).
- Fields the viewer may not see are `null`:
  - `address` and `household.phone`: the assigned collector only after accept; always for admins.
  - `pickupCode`: the household only, while `ACCEPTED`.
  - `collector.phone`: the household, the collector and admins.
- `lines` is the latest weigh round; `weighRounds` keeps every round (re-weighs add a version).
- `photos[].url` are download links valid for 15 minutes.

**Request**

```http
GET /api/v1/pickups/7d5454fd-9794-4bdb-bea8-d34ac7b7e83f
Authorization: Bearer <accessToken>
```

**Response**

`200`

```json
{
  "id": "7d5454fd-9794-4bdb-bea8-d34ac7b7e83f",
  "displayNo": "BW-1004",
  "status": "COMPLETED",
  "slotDate": "2026-11-15",
  "slot": "MORNING",
  "weightBand": "FROM_5_TO_15",
  "categoryCodes": [
    "IRON",
    "NEWSPAPER",
    "ELECTRONICS"
  ],
  "area": "Mirpur 10",
  "estimate": {
    "min": 200,
    "max": 600
  },
  "address": {
    "text": "House 12, Road 4, Block C, Mirpur 10, Dhaka",
    "lat": 23.8069,
    "lng": 90.3687,
    "note": "Ring the bell twice"
  },
  "household": {
    "id": "68aca7b0-6e76-400a-989a-92376f21cc50",
    "name": "Morium Khatun",
    "phone": "+8801916408620"
  },
  "collector": {
    "id": "dd2cc39a-1000-4eb2-8554-33f398685af0",
    "name": "Sohel Rana",
    "rating": 5,
    "phone": "+8801816408620"
  },
  "pickupCode": null,
  "codeLocked": false,
  "lines": [
    {
      "categoryCode": "IRON",
      "kg": 9.5,
      "rate": 50,
      "amount": 475
    },
    {
      "categoryCode": "NEWSPAPER",
      "kg": 5,
      "rate": 30,
      "amount": 150
    },
    {
      "categoryCode": "ELECTRONICS",
      "kg": 3.5,
      "rate": null,
      "amount": 300
    }
  ],
  "weighVersion": 2,
  "weighRounds": [
    {
      "version": 1,
      "lines": [
        {
          "categoryCode": "IRON",
          "kg": 9,
          "rate": 50,
          "amount": 450
        },
        {
          "categoryCode": "NEWSPAPER",
          "kg": 5,
          "rate": 30,
          "amount": 150
        },
        {
          "categoryCode": "ELECTRONICS",
          "kg": 3.5,
          "rate": null,
          "amount": 300
        }
      ],
      "totalKg": 17.5,
      "totalAmount": 900,
      "scalePhotoId": "73c63b2c-f016-4b83-9deb-de5c079b8336",
      "weighedBy": "COLLECTOR",
      "createdAt": "2026-11-14T11:40:10.623Z"
    },
    {
      "version": 2,
      "lines": [
        {
          "categoryCode": "IRON",
          "kg": 9.5,
          "rate": 50,
          "amount": 475
        },
        {
          "categoryCode": "NEWSPAPER",
          "kg": 5,
          "rate": 30,
          "amount": 150
        },
        {
          "categoryCode": "ELECTRONICS",
          "kg": 3.5,
          "rate": null,
          "amount": 300
        }
      ],
      "totalKg": 18,
      "totalAmount": 925,
      "scalePhotoId": "4020011b-ebad-4b7e-b869-1a64bbca77c5",
      "weighedBy": "COLLECTOR",
      "createdAt": "2026-11-14T11:40:10.763Z"
    }
  ],
  "photos": [
    {
      "id": "f1c2c9a7-9657-4654-8c12-dea8863974e4",
      "kind": "ITEMS",
      "weighVersion": null,
      "url": "http://localhost:8333/bhangariwala-photos/pickups/7d5454fd-9794-4bdb-bea8-d34ac7b7e83f/f1c2c9a7-9657-4654-8c12-dea8863974e4.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=…&X-Amz-Signature=…",
      "createdAt": "2026-11-14T11:40:10.358Z"
    },
    {
      "id": "73c63b2c-f016-4b83-9deb-de5c079b8336",
      "kind": "SCALE",
      "weighVersion": 1,
      "url": "http://localhost:8333/bhangariwala-photos/pickups/7d5454fd-9794-4bdb-bea8-d34ac7b7e83f/73c63b2c-f016-4b83-9deb-de5c079b8336.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=…&X-Amz-Signature=…",
      "createdAt": "2026-11-14T11:40:10.605Z"
    },
    {
      "id": "4020011b-ebad-4b7e-b869-1a64bbca77c5",
      "kind": "SCALE",
      "weighVersion": 2,
      "url": "http://localhost:8333/bhangariwala-photos/pickups/7d5454fd-9794-4bdb-bea8-d34ac7b7e83f/4020011b-ebad-4b7e-b869-1a64bbca77c5.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=…&X-Amz-Signature=…",
      "createdAt": "2026-11-14T11:40:10.735Z"
    }
  ],
  "totalKg": 18,
  "totalAmount": 925,
  "paymentMethod": "BKASH",
  "walletNumber": "+8801812345678",
  "payment": {
    "method": "BKASH",
    "amount": 925,
    "walletNumber": "+8801812345678",
    "trxId": "9KQ6408620",
    "status": "VERIFIED",
    "paidAt": "2026-11-14T11:40:10.913Z"
  },
  "openDispute": null,
  "searchRadiusM": 1000,
  "requestedAt": "2026-11-14T11:40:10.232Z",
  "acceptedAt": "2026-11-14T11:40:10.436Z",
  "arrivedAt": "2026-11-14T11:40:10.565Z",
  "weighedAt": "2026-11-14T11:40:10.763Z",
  "confirmedAt": "2026-11-14T11:40:10.867Z",
  "completedAt": "2026-11-14T11:40:10.913Z",
  "cancelledAt": null,
  "expiresAt": "2026-11-15T06:00:00.000Z"
}
```

**Example: As the household while ACCEPTED (has the pickup code)**

`200`

```json
{
  "status": "ACCEPTED",
  "pickupCode": "6356",
  "codeLocked": false,
  "collector": {
    "id": "dd2cc39a-1000-4eb2-8554-33f398685af0",
    "name": "Sohel Rana",
    "rating": null,
    "phone": "+8801816408620"
  },
  "address": {
    "text": "House 12, Road 4, Block C, Mirpur 10, Dhaka",
    "lat": 23.8069,
    "lng": 90.3687,
    "note": "Ring the bell twice"
  },
  "household": {
    "id": "68aca7b0-6e76-400a-989a-92376f21cc50",
    "name": "Morium Khatun",
    "phone": null
  },
  "estimate": {
    "min": 200,
    "max": 600
  }
}
```

_Shortened to the fields this call changes; every pickup response has the full shape shown under [GET /pickups/{pickupId}](#get-pickupspickupid)._

**Example: As the assigned collector after confirm (sees phone, address and wallet)**

`200`

```json
{
  "status": "CONFIRMED",
  "address": {
    "text": "House 12, Road 4, Block C, Mirpur 10, Dhaka",
    "lat": 23.8069,
    "lng": 90.3687,
    "note": "Ring the bell twice"
  },
  "household": {
    "id": "68aca7b0-6e76-400a-989a-92376f21cc50",
    "name": "Morium Khatun",
    "phone": "+8801916408620"
  },
  "paymentMethod": "BKASH",
  "walletNumber": "+8801812345678",
  "totalAmount": 925
}
```

_Shortened to the fields this call changes; every pickup response has the full shape shown under [GET /pickups/{pickupId}](#get-pickupspickupid)._

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `NOT_FOUND` | 404 | Unknown pickup, or not the viewer's |
| `VALIDATION_ERROR` | 400 | Not a UUID |

### GET /me/pickups

Own pickups, newest first: the household's requests, or the collector's assigned pickups (history screens H11 and C8).

**Who:** Household or collector · **Since:** M2

- Query: `status` = `ACTIVE` (REQUESTED to CONFIRMED), `COMPLETED`, `CANCELLED` (includes EXPIRED), or `PAST` (COMPLETED, CANCELLED and EXPIRED; the collector's C8 past tab, since M4); `limit` 1-50 (default 20); `cursor` from the previous page.
- `nextCursor` is `null` on the last page.

**Request**

```http
GET /api/v1/me/pickups?limit=2
Authorization: Bearer <accessToken>
```

**Response**

`200`

```json
{
  "items": [
    {
      "id": "167ce2e4-5a08-43d7-9e54-6c75335eccbe",
      "displayNo": "BW-1006",
      "status": "CANCELLED",
      "slotDate": "2026-11-15",
      "slot": "MIDDAY",
      "categoryCodes": [
        "CARTON"
      ],
      "totalAmount": null
    },
    {
      "id": "d50627cd-3515-41d1-9f7d-76249174da70",
      "displayNo": "BW-1005",
      "status": "CANCELLED",
      "slotDate": "2026-11-15",
      "slot": "AFTERNOON",
      "categoryCodes": [
        "PLASTIC"
      ],
      "totalAmount": null
    }
  ],
  "nextCursor": "MjAyNi0xMS0xNFQxMTo0MDoxMS4wMDNafGQ1MDYyN2NkLTM1MTUtNDFkMS05ZjdkLTc2MjQ5MTc0ZGE3MA"
}
```

_Each item is a full Pickup; shortened here._

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Bad cursor or limit |

### GET /me/summary

Totals for the history screen header (H11): how many pickups were completed, the kg sold and the taka earned.

**Who:** Household · **Since:** M3

- Counts `COMPLETED` pickups only; `totalAmount` is the server-computed total the household was paid.

**Request**

```http
GET /api/v1/me/summary
Authorization: Bearer <accessToken>
```

**Response**

`200`

```json
{
  "completedCount": 1,
  "totalKg": 14.5,
  "totalAmount": 605
}
```

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `FORBIDDEN` | 403 | Called by a collector or admin |

### Pickup fields added in M3

Every Pickup response now also has:

- `collectorLocation`: the assigned collector's last known position (`{ lat, lng, at }`), so the household's map (H6) has a point before the next `collector.location` event. Only for the household and admins, and only while `ACCEPTED`; `null` otherwise.
- `rating`: the household's rating of the pickup (`{ stars, comment, createdAt }`), for the household, the assigned collector and admins; `null` until rated.

While `ACCEPTED`, as the household:

```json
{
  "status": "ACCEPTED",
  "collectorLocation": {
    "lat": 23.8081,
    "lng": 90.3684,
    "at": "2026-11-14T18:49:57.835Z"
  },
  "rating": null
}
```

After payment and rating:

```json
{
  "status": "COMPLETED",
  "collectorLocation": null,
  "rating": {
    "stars": 5,
    "comment": "Weighed in front of me",
    "createdAt": "2026-11-14T18:49:57.953Z"
  }
}
```

_Shortened to the new fields._

### Pickup fields added in M4

- `lockedRates`: the rate copied onto each item at accept (`[{ categoryCode, rate }]`, `rate` `null` for electronics), so the collector's weigh screen (C4) can preview totals while the household's rate board may already show a correction. For the household, the assigned collector and admins from `ACCEPTED` on; `null` before accept. An item added at weighing appears with the rate it got then.

```json
{
  "status": "ACCEPTED",
  "lockedRates": [
    {
      "categoryCode": "IRON",
      "rate": 50
    },
    {
      "categoryCode": "NEWSPAPER",
      "rate": 30
    }
  ]
}
```

### POST /pickups/{pickupId}/cancel

The household cancels before the collector arrives.

**Who:** Household (own pickup) · **Since:** M2

- Allowed while `REQUESTED` or `ACCEPTED`. Collectors who saw the request get `request.taken`; the assigned collector gets `pickup.cancelled`.
- Admins cancel with [POST /admin/pickups/{pickupId}/cancel](#post-adminpickupspickupidcancel).

**Request**

```http
POST /api/v1/pickups/d50627cd-3515-41d1-9f7d-76249174da70/cancel
Authorization: Bearer <accessToken>
```

```json
{
  "reason": "Sold to a neighbour"
}
```

**Response**

`200`

```json
{
  "id": "d50627cd-3515-41d1-9f7d-76249174da70",
  "displayNo": "BW-1005",
  "status": "CANCELLED",
  "cancelledAt": "2026-11-14T11:40:11.107Z",
  "collector": null
}
```

_Shortened to the fields this call changes; every pickup response has the full shape shown under [GET /pickups/{pickupId}](#get-pickupspickupid)._

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `INVALID_STATE` | 409 | Collector already arrived, or pickup finished |
| `NOT_FOUND` | 404 | Not the household's pickup |

<details><summary>Example: Already cancelled</summary>

```http
POST /api/v1/pickups/d50627cd-3515-41d1-9f7d-76249174da70/cancel
Authorization: Bearer <accessToken>
```

```json
{}
```

`409`

```json
{
  "code": "INVALID_STATE",
  "message": "This pickup is cancelled, so that cannot be done now. Refresh to see the latest.",
  "details": {
    "status": "CANCELLED"
  }
}
```

</details>

### POST /pickups/{pickupId}/accept

Claims a request. The first collector to accept wins.

**Who:** Collector (approved, online) · **Since:** M2 · **Idempotency-Key:** required

- One atomic update that only succeeds while the request is still `REQUESTED`, unexpired, and within its current radius of the collector's last location.
- Today's rates are copied onto the pickup (`rate_snapshot`), and a 4-digit pickup code is created for the household.
- The response now includes the exact address and the household's phone.

**Request**

```http
POST /api/v1/pickups/7d5454fd-9794-4bdb-bea8-d34ac7b7e83f/accept
Authorization: Bearer <accessToken>
Idempotency-Key: 6f1d2c3a-…
```

**Response**

`200`

```json
{
  "id": "7d5454fd-9794-4bdb-bea8-d34ac7b7e83f",
  "displayNo": "BW-1004",
  "status": "ACCEPTED",
  "acceptedAt": "2026-11-14T11:40:10.436Z",
  "address": {
    "text": "House 12, Road 4, Block C, Mirpur 10, Dhaka",
    "lat": 23.8069,
    "lng": 90.3687,
    "note": "Ring the bell twice"
  },
  "household": {
    "id": "68aca7b0-6e76-400a-989a-92376f21cc50",
    "name": "Morium Khatun",
    "phone": "+8801916408620"
  },
  "collector": {
    "id": "dd2cc39a-1000-4eb2-8554-33f398685af0",
    "name": "Sohel Rana",
    "rating": null,
    "phone": "+8801816408620"
  },
  "pickupCode": null
}
```

_Shortened to the fields this call changes; every pickup response has the full shape shown under [GET /pickups/{pickupId}](#get-pickupspickupid)._

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `ALREADY_TAKEN` | 409 | Another collector accepted first |
| `INVALID_STATE` | 409 | Cancelled or expired |
| `OUT_OF_RANGE` | 422 | Too far, offline, or no location ping for 10 minutes |
| `NOT_APPROVED` | 403 | Collector not approved |

<details><summary>Example: Second collector, a moment later</summary>

```http
POST /api/v1/pickups/7d5454fd-9794-4bdb-bea8-d34ac7b7e83f/accept
Authorization: Bearer <accessToken>
Idempotency-Key: 6f1d2c3a-…
```

`409`

```json
{
  "code": "ALREADY_TAKEN",
  "message": "Another collector accepted this request first. Pick another one."
}
```

</details>

### POST /pickups/{pickupId}/release

Gives an accepted request back before arriving.

**Who:** Assigned collector · **Since:** M2

- Only while `ACCEPTED`. Clears the collector, the pickup code and the copied rates; the request reopens at 1 km and the 5-minute widening clock restarts.
- Not allowed once the code is locked (`423`).

**Request**

```http
POST /api/v1/pickups/d50627cd-3515-41d1-9f7d-76249174da70/release
Authorization: Bearer <accessToken>
```

```json
{
  "reason": "Van broke down"
}
```

**Response**

`204` with no body.

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `INVALID_STATE` | 409 | Not ACCEPTED |
| `CODE_LOCKED` | 423 | Code locked after 5 wrong tries |
| `NOT_FOUND` | 404 | Not the collector's pickup |

### POST /pickups/{pickupId}/arrive

The collector enters the household's 4-digit code at the door (status `ARRIVED`).

**Who:** Assigned collector · **Since:** M2

- Codes are stored hashed. A wrong code returns `attemptsLeft`; the 5th wrong code locks the pickup and admins get `pickup.code_locked`.

**Request**

```http
POST /api/v1/pickups/7d5454fd-9794-4bdb-bea8-d34ac7b7e83f/arrive
Authorization: Bearer <accessToken>
```

```json
{
  "code": "6356"
}
```

**Response**

`200`

```json
{
  "id": "7d5454fd-9794-4bdb-bea8-d34ac7b7e83f",
  "displayNo": "BW-1004",
  "status": "ARRIVED",
  "arrivedAt": "2026-11-14T11:40:10.565Z",
  "pickupCode": null
}
```

_Shortened to the fields this call changes; every pickup response has the full shape shown under [GET /pickups/{pickupId}](#get-pickupspickupid)._

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `CODE_MISMATCH` | 422 | Wrong code; `details.attemptsLeft` |
| `CODE_LOCKED` | 423 | 5 wrong codes |
| `INVALID_STATE` | 409 | Not ACCEPTED |

<details><summary>Example: Wrong code</summary>

```http
POST /api/v1/pickups/7d5454fd-9794-4bdb-bea8-d34ac7b7e83f/arrive
Authorization: Bearer <accessToken>
```

```json
{
  "code": "0000"
}
```

`422`

```json
{
  "code": "CODE_MISMATCH",
  "message": "That pickup code is wrong. Ask the household for the 4-digit code; 4 tries left.",
  "details": {
    "attemptsLeft": 4
  }
}
```

</details>

### POST /pickups/{pickupId}/photos

Gets a presigned link to upload a photo straight to storage.

**Who:** Household (ITEMS), collector or admin (SCALE) · **Since:** M2

- `ITEMS`: the household, while the pickup is active or completed (item photos, dispute evidence).
- `SCALE`: the assigned collector while `ARRIVED` or `DISPUTED`, or an admin while `DISPUTED`.
- Then `PUT` the file to `uploadUrl` with the same `Content-Type` before `expiresAt` (10 minutes). Use `photoId` in later calls.
- Up to 30 photos per pickup.

**Request**

```http
POST /api/v1/pickups/7d5454fd-9794-4bdb-bea8-d34ac7b7e83f/photos
Authorization: Bearer <accessToken>
```

```json
{
  "kind": "SCALE",
  "contentType": "image/jpeg"
}
```

Then upload the file to the returned link:

```http
PUT <uploadUrl>
Content-Type: image/jpeg

<file bytes>
```

**Response**

`201`

```json
{
  "photoId": "73c63b2c-f016-4b83-9deb-de5c079b8336",
  "uploadUrl": "http://localhost:8333/bhangariwala-photos/pickups/7d5454fd-9794-4bdb-bea8-d34ac7b7e83f/73c63b2c-f016-4b83-9deb-de5c079b8336.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=…&X-Amz-Signature=…",
  "expiresAt": "2026-11-14T11:50:10.605Z"
}
```

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `FORBIDDEN` | 403 | Wrong role for this kind |
| `INVALID_STATE` | 409 | Not a status that takes this kind of photo |
| `NOT_FOUND` | 404 | Not the user's pickup |

### POST /pickups/{pickupId}/weights

Sends a weigh round. The server computes every amount and the totals (status `WEIGHED`).

**Who:** Assigned collector, or admin after TEAM_REWEIGH · **Since:** M2 · **Idempotency-Key:** required

- First weigh while `ARRIVED`; re-weigh while `DISPUTED` with an open `REWEIGH` dispute (closes it); an admin weighs after resolving with `TEAM_REWEIGH`.
- One line per category, at most once; kg to 0.1. Per-kg lines use the rate copied at accept; electronics need `quotedAmount`. Requested categories left out are not sold.
- **Since M4:** a category the household did not list (found at the door) is added to the pickup; a per-kg one takes the rate in effect at that moment (`400 VALIDATION_ERROR` if it has never had a rate). See the example below.
- `scalePhotoId` must be an uploaded `SCALE` photo of this pickup by the same user, not used by an earlier round.

**Request**

```http
POST /api/v1/pickups/7d5454fd-9794-4bdb-bea8-d34ac7b7e83f/weights
Authorization: Bearer <accessToken>
Idempotency-Key: 6f1d2c3a-…
```

```json
{
  "lines": [
    {
      "categoryCode": "IRON",
      "kg": 9
    },
    {
      "categoryCode": "NEWSPAPER",
      "kg": 5
    },
    {
      "categoryCode": "ELECTRONICS",
      "kg": 3.5,
      "quotedAmount": 300
    }
  ],
  "scalePhotoId": "73c63b2c-f016-4b83-9deb-de5c079b8336"
}
```

**Response**

`200`

```json
{
  "id": "7d5454fd-9794-4bdb-bea8-d34ac7b7e83f",
  "displayNo": "BW-1004",
  "status": "WEIGHED",
  "lines": [
    {
      "categoryCode": "IRON",
      "kg": 9,
      "rate": 50,
      "amount": 450
    },
    {
      "categoryCode": "NEWSPAPER",
      "kg": 5,
      "rate": 30,
      "amount": 150
    },
    {
      "categoryCode": "ELECTRONICS",
      "kg": 3.5,
      "rate": null,
      "amount": 300
    }
  ],
  "weighVersion": 1,
  "totalKg": 17.5,
  "totalAmount": 900,
  "weighedAt": "2026-11-14T11:40:10.623Z"
}
```

_Shortened to the fields this call changes; every pickup response has the full shape shown under [GET /pickups/{pickupId}](#get-pickupspickupid)._

**Example: Re-weigh after the first rejection (version 2)**

Request:

```json
{
  "lines": [
    {
      "categoryCode": "IRON",
      "kg": 9.5
    },
    {
      "categoryCode": "NEWSPAPER",
      "kg": 5
    },
    {
      "categoryCode": "ELECTRONICS",
      "kg": 3.5,
      "quotedAmount": 300
    }
  ],
  "scalePhotoId": "4020011b-ebad-4b7e-b869-1a64bbca77c5"
}
```

Response:

`200`

```json
{
  "id": "7d5454fd-9794-4bdb-bea8-d34ac7b7e83f",
  "displayNo": "BW-1004",
  "status": "WEIGHED",
  "weighVersion": 2,
  "totalKg": 18,
  "totalAmount": 925,
  "openDispute": null
}
```

_Shortened to the fields this call changes; every pickup response has the full shape shown under [GET /pickups/{pickupId}](#get-pickupspickupid)._

<details><summary>Example: Adding carton found at the door (M4)</summary>

```json
{
  "lines": [
    {
      "categoryCode": "IRON",
      "kg": 9.5
    },
    {
      "categoryCode": "NEWSPAPER",
      "kg": 5
    },
    {
      "categoryCode": "CARTON",
      "kg": 3
    }
  ],
  "scalePhotoId": "\u2026"
}
```

`200` (shortened to the changed fields)

```json
{
  "status": "WEIGHED",
  "categoryCodes": [
    "IRON",
    "NEWSPAPER",
    "CARTON"
  ],
  "lines": [
    {
      "categoryCode": "IRON",
      "kg": 9.5,
      "rate": 50,
      "amount": 475
    },
    {
      "categoryCode": "NEWSPAPER",
      "kg": 5,
      "rate": 30,
      "amount": 150
    },
    {
      "categoryCode": "CARTON",
      "kg": 3,
      "rate": 18,
      "amount": 54
    }
  ],
  "totalKg": 17.5,
  "totalAmount": 679,
  "lockedRates": [
    {
      "categoryCode": "IRON",
      "rate": 50
    },
    {
      "categoryCode": "NEWSPAPER",
      "rate": 30
    },
    {
      "categoryCode": "CARTON",
      "rate": 18
    }
  ]
}
```

</details>

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `SCALE_PHOTO_REQUIRED` | 422 | Photo missing, not uploaded, someone else's, or already used |
| `VALIDATION_ERROR` | 400 | Unknown or inactive category, an added category with no rate, duplicate, kg not to 0.1, quote missing or not allowed |
| `INVALID_STATE` | 409 | Not ARRIVED, or the dispute is with admins |

<details><summary>Example: Without an uploaded scale photo</summary>

```http
POST /api/v1/pickups/7d5454fd-9794-4bdb-bea8-d34ac7b7e83f/weights
Authorization: Bearer <accessToken>
Idempotency-Key: 6f1d2c3a-…
```

```json
{
  "lines": [
    {
      "categoryCode": "IRON",
      "kg": 9
    }
  ],
  "scalePhotoId": "9793d88c-d8f8-4289-a5cd-b1041ef63be0"
}
```

`422`

```json
{
  "code": "SCALE_PHOTO_REQUIRED",
  "message": "Take a new photo of the scale for this weigh and upload it first."
}
```

</details>

### POST /pickups/{pickupId}/confirm

The household approves the weights and chooses how to be paid (status `CONFIRMED`).

**Who:** Household · **Since:** M2 · **Idempotency-Key:** required

- Only while `WEIGHED`; nothing is confirmed automatically.
- `walletNumber` is required for `BKASH` and `NAGAD`.

**Request**

```http
POST /api/v1/pickups/7d5454fd-9794-4bdb-bea8-d34ac7b7e83f/confirm
Authorization: Bearer <accessToken>
Idempotency-Key: 6f1d2c3a-…
```

```json
{
  "paymentMethod": "BKASH",
  "walletNumber": "+8801812345678"
}
```

**Response**

`200`

```json
{
  "id": "7d5454fd-9794-4bdb-bea8-d34ac7b7e83f",
  "displayNo": "BW-1004",
  "status": "CONFIRMED",
  "paymentMethod": "BKASH",
  "walletNumber": "+8801812345678",
  "totalAmount": 925,
  "confirmedAt": "2026-11-14T11:40:10.867Z"
}
```

_Shortened to the fields this call changes; every pickup response has the full shape shown under [GET /pickups/{pickupId}](#get-pickupspickupid)._

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Wallet number missing for bKash or Nagad |
| `INVALID_STATE` | 409 | Not WEIGHED |

### POST /pickups/{pickupId}/dispute

The household rejects the weights or reports a problem.

**Who:** Household · **Since:** M2

- `WEIGHT` (while `WEIGHED`): the pickup goes `DISPUTED`. First time `REWEIGH` (the collector re-weighs); after that `ADMIN_REVIEW`.
- `PAYMENT` (while `COMPLETED`, "payment not received"): `ADMIN_REVIEW`; the payment is marked `REPORTED` and the pickup stays `COMPLETED`.
- `BEHAVIOUR`, `OTHER` (any time after accept): `ADMIN_REVIEW`; the status does not change.
- One open dispute per pickup. `photoIds` must be the household's own ITEMS photos of this pickup.

**Request**

```http
POST /api/v1/pickups/7d5454fd-9794-4bdb-bea8-d34ac7b7e83f/dispute
Authorization: Bearer <accessToken>
```

```json
{
  "type": "WEIGHT",
  "reason": "লোহা অন্তত ১১ কেজি হবে"
}
```

**Response**

`201`

```json
{
  "id": "d6259fd4-0b38-4581-9f6e-9c91417680af",
  "pickupId": "7d5454fd-9794-4bdb-bea8-d34ac7b7e83f",
  "displayNo": "BW-1004",
  "type": "WEIGHT",
  "status": "REWEIGH",
  "raisedBy": "68aca7b0-6e76-400a-989a-92376f21cc50",
  "reason": "লোহা অন্তত ১১ কেজি হবে",
  "photoIds": [],
  "outcome": null,
  "resolutionNote": null,
  "createdAt": "2026-11-14T11:40:10.703Z",
  "resolvedAt": null
}
```

**Example: Second weight rejection (goes to admins)**

Request:

```json
{
  "type": "WEIGHT",
  "reason": "Still too low"
}
```

Response:

`201`

```json
{
  "id": "a5c93535-1bba-4ed6-9c62-7fbeaabd6270",
  "pickupId": "7d5454fd-9794-4bdb-bea8-d34ac7b7e83f",
  "displayNo": "BW-1004",
  "type": "WEIGHT",
  "status": "ADMIN_REVIEW",
  "raisedBy": "68aca7b0-6e76-400a-989a-92376f21cc50",
  "reason": "Still too low",
  "photoIds": [],
  "outcome": null,
  "resolutionNote": null,
  "createdAt": "2026-11-14T11:40:10.824Z",
  "resolvedAt": null
}
```

**Example: Payment not received**

Request:

```json
{
  "type": "PAYMENT",
  "reason": "bKash message did not arrive"
}
```

Response:

`201`

```json
{
  "id": "efbbfa65-6c30-4143-b086-4e3cd2dd620b",
  "pickupId": "7d5454fd-9794-4bdb-bea8-d34ac7b7e83f",
  "displayNo": "BW-1004",
  "type": "PAYMENT",
  "status": "ADMIN_REVIEW",
  "raisedBy": "68aca7b0-6e76-400a-989a-92376f21cc50",
  "reason": "bKash message did not arrive",
  "photoIds": [],
  "outcome": null,
  "resolutionNote": null,
  "createdAt": "2026-11-14T11:40:10.956Z",
  "resolvedAt": null
}
```

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `INVALID_STATE` | 409 | Wrong status for the type, or a dispute is already open |
| `VALIDATION_ERROR` | 400 | Photos not the household's |

### POST /pickups/{pickupId}/payment

The collector records the payment (status `COMPLETED`).

**Who:** Assigned collector · **Since:** M2 · **Idempotency-Key:** required

- Only while `CONFIRMED`, with the method the household chose. The amount is the pickup total from the server.
- `trxId` is required for `BKASH` and `NAGAD` and can be used once per method; it is stored in capitals.
- After an admin resolves a payment dispute with `PAY_AGAIN`, call this again on the `COMPLETED` pickup with a new TrxID.

**Request**

```http
POST /api/v1/pickups/7d5454fd-9794-4bdb-bea8-d34ac7b7e83f/payment
Authorization: Bearer <accessToken>
Idempotency-Key: 6f1d2c3a-…
```

```json
{
  "method": "BKASH",
  "trxId": "9KQ6408620"
}
```

**Response**

`200`

```json
{
  "id": "7d5454fd-9794-4bdb-bea8-d34ac7b7e83f",
  "displayNo": "BW-1004",
  "status": "COMPLETED",
  "completedAt": "2026-11-14T11:40:10.913Z",
  "payment": {
    "method": "BKASH",
    "amount": 925,
    "walletNumber": "+8801812345678",
    "trxId": "9KQ6408620",
    "status": "PAID",
    "paidAt": "2026-11-14T11:40:10.913Z"
  }
}
```

_Shortened to the fields this call changes; every pickup response has the full shape shown under [GET /pickups/{pickupId}](#get-pickupspickupid)._

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `TRX_ID_REQUIRED` | 422 | bKash or Nagad without a TrxID |
| `TRX_ID_REUSED` | 409 | TrxID already used |
| `VALIDATION_ERROR` | 400 | Method differs from the one confirmed |
| `INVALID_STATE` | 409 | Not CONFIRMED, or already paid |

<details><summary>Example: bKash without a TrxID</summary>

```http
POST /api/v1/pickups/7d5454fd-9794-4bdb-bea8-d34ac7b7e83f/payment
Authorization: Bearer <accessToken>
Idempotency-Key: 6f1d2c3a-…
```

```json
{
  "method": "BKASH"
}
```

`422`

```json
{
  "code": "TRX_ID_REQUIRED",
  "message": "Enter the TrxID from the bKash or Nagad message you got after sending the money."
}
```

</details>

### POST /pickups/{pickupId}/rating

Rates the collector 1 to 5 stars after a completed pickup; updates the collector's average.

**Who:** Household · **Since:** M2

- Once per pickup.

**Request**

```http
POST /api/v1/pickups/7d5454fd-9794-4bdb-bea8-d34ac7b7e83f/rating
Authorization: Bearer <accessToken>
```

```json
{
  "stars": 5,
  "comment": "ভালো ব্যবহার"
}
```

**Response**

`204` with no body.

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `INVALID_STATE` | 409 | Not COMPLETED, or already rated |

## Collector

The collector app (M4): sign-up and approval (C6, C7), going online and the nearby list (C1), the profile (C11) and the ledger (C9). Accepting and working a pickup use the [Pickups](#pickups) endpoints.

### POST /collector/selfie

Gets a presigned link to upload the sign-up selfie (C6) to private storage.

**Who:** Collector (before or after sign-up) · **Since:** M4

- Body: `contentType` (`image/jpeg` default, `image/png`, `image/webp`); may be empty.
- `PUT` the file to `uploadUrl` with the same `Content-Type` before `expiresAt`, then send `photoId` to `POST /collector/signup`.
- Selfies are private: only the collector and admins get a short-lived link (`CollectorProfile.selfieUrl`). At most 20 per collector.

**Request**

```http
POST /api/v1/collector/selfie
Authorization: Bearer <accessToken>
```

```json
{}
```

**Response**

`201`

```json
{
  "photoId": "33ab0f6f-658b-47f7-929f-920f82c6b0b2",
  "uploadUrl": "http://localhost:8333/bhangariwala-photos/selfies/69985e76-2e4e-4412-b5fa-99bc7ac3fffb/33ab0f6f-658b-47f7-929f-920f82c6b0b2.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&…&X-Amz-Signature=…",
  "expiresAt": "2026-11-16T13:43:48.668Z"
}
```

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Bad content type, or 20 selfies already uploaded |

### POST /collector/signup

Submits the collector application (C6). The profile is saved with verification `PENDING` and the account name is set.

**Who:** Collector · **Since:** M4

- `nidNumber`: 10, 13 or 17 digits. `workAreas`: 1 to 10 distinct Dhaka area codes (`WorkArea` in the contract; names in `WORK_AREAS` in `@bw/shared`). `acceptedAgreement` must be `true`.
- `selfiePhotoId` must be this collector's selfie and already uploaded.
- A `REJECTED` collector may apply again: back to `PENDING`, the old note cleared. `PENDING` or `APPROVED` gets `409`.
- The response never contains the full NID number (`nidNumberMasked` keeps the first 2 and last 4 digits).

**Request**

```http
POST /api/v1/collector/signup
Authorization: Bearer <accessToken>
```

```json
{
  "name": "Jasim Uddin",
  "nidNumber": "1987654321",
  "selfiePhotoId": "33ab0f6f-658b-47f7-929f-920f82c6b0b2",
  "workAreas": [
    "MIRPUR",
    "PALLABI"
  ],
  "vehicleType": "VAN",
  "hasScale": true,
  "acceptedAgreement": true
}
```

**Response**

`201`

```json
{
  "userId": "69985e76-2e4e-4412-b5fa-99bc7ac3fffb",
  "name": "Jasim Uddin",
  "phone": "+8801708955427",
  "nidNumberMasked": "19XX XX 4321",
  "nidVerified": false,
  "selfieUrl": "http://localhost:8333/bhangariwala-photos/selfies/69985e76-2e4e-4412-b5fa-99bc7ac3fffb/33ab0f6f-658b-47f7-929f-920f82c6b0b2.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&…&X-Amz-Signature=…",
  "workAreas": [
    "MIRPUR",
    "PALLABI"
  ],
  "vehicleType": "VAN",
  "hasScale": true,
  "verificationStatus": "PENDING",
  "verificationNote": null,
  "submittedAt": "2026-11-16T13:33:48.759Z",
  "decidedAt": null,
  "isOnline": false,
  "ratingAvg": null,
  "pickups30d": 0,
  "releases30d": 0
}
```

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | A field is missing or wrong, or the selfie is not this collector's or not uploaded yet |
| `INVALID_STATE` | 409 | An application is already PENDING, or the collector is APPROVED |

### GET /collector/profile

The collector's own profile: verification status (and the admin's note when rejected), work details, rating and 30-day activity (C7, C11).

**Who:** Collector · **Since:** M4

- `404 NOT_FOUND` until the collector has applied; the app then opens sign-up (C6).
- `pickups30d`: pickups completed in the last 30 days; `releases30d`: requests given back in the last 30 days.

**Request**

```http
GET /api/v1/collector/profile
Authorization: Bearer <accessToken>
```

**Response**

`200`

```json
{
  "userId": "69985e76-2e4e-4412-b5fa-99bc7ac3fffb",
  "name": "Jasim Uddin",
  "phone": "+8801708955427",
  "nidNumberMasked": "19XX XX 4321",
  "nidVerified": false,
  "selfieUrl": "http://localhost:8333/bhangariwala-photos/selfies/69985e76-2e4e-4412-b5fa-99bc7ac3fffb/33ab0f6f-658b-47f7-929f-920f82c6b0b2.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&…&X-Amz-Signature=…",
  "workAreas": [
    "MIRPUR",
    "KAFRUL"
  ],
  "vehicleType": "VAN",
  "hasScale": true,
  "verificationStatus": "APPROVED",
  "verificationNote": null,
  "submittedAt": "2026-11-16T13:33:48.759Z",
  "decidedAt": "2026-11-16T13:33:48.810Z",
  "isOnline": true,
  "ratingAvg": null,
  "pickups30d": 1,
  "releases30d": 0
}
```

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `NOT_FOUND` | 404 | Not applied yet |

### PATCH /collector/profile

Changes work areas, vehicle or scale (C11 "বদলান"). Does not change the verification status.

**Who:** Collector (signed up) · **Since:** M4

**Request**

```http
PATCH /api/v1/collector/profile
Authorization: Bearer <accessToken>
```

```json
{
  "workAreas": [
    "MIRPUR",
    "KAFRUL"
  ]
}
```

**Response**

`200` with the updated `CollectorProfile` (as above).

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | No field sent, or a field is not valid |
| `NOT_FOUND` | 404 | Not applied yet |

### GET /collector/ledger

Payouts and kg collected for a date range (C1's today totals and C9).

**Who:** Collector · **Since:** M4

- Query: `from` and `to`, Dhaka calendar dates, inclusive; at most 92 days.
- Counts `COMPLETED` pickups whose payment is `PAID` or `VERIFIED`, by payment time. A "not received" report (`REPORTED`) drops out until it is settled.
- `byCategory` is kg from each pickup's final weigh round, largest first; `payments` newest first.

**Request**

```http
GET /api/v1/collector/ledger?from=2026-11-16&to=2026-11-16
Authorization: Bearer <accessToken>
```

**Response**

`200`

```json
{
  "from": "2026-11-16",
  "to": "2026-11-16",
  "totalPaid": 679,
  "totalKg": 17.5,
  "pickupCount": 1,
  "byMethod": {
    "CASH": 0,
    "BKASH": 679,
    "NAGAD": 0
  },
  "byCategory": [
    {
      "categoryCode": "IRON",
      "kg": 9.5
    },
    {
      "categoryCode": "NEWSPAPER",
      "kg": 5
    },
    {
      "categoryCode": "CARTON",
      "kg": 3
    }
  ],
  "payments": [
    {
      "pickupId": "476ead8e-6bae-494e-97c1-f94e09cb381a",
      "householdName": "Rasheda Begum",
      "method": "BKASH",
      "trxId": "9KXMWJB13IE",
      "amount": 679,
      "paidAt": "2026-11-16T13:33:49.197Z"
    }
  ]
}
```

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | A date is missing or not real, `from` is after `to`, or the range is longer than 92 days |


### PUT /collector/status

Goes online (with a location) or offline. Only online collectors are matched.

**Who:** Approved collector · **Since:** M2

- `location` is required to go online.
- A collector with no location ping for 10 minutes is treated as offline.

**Request**

```http
PUT /api/v1/collector/status
Authorization: Bearer <accessToken>
```

```json
{
  "online": true,
  "location": {
    "lat": 23.8091,
    "lng": 90.3687
  }
}
```

**Response**

`204` with no body.

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `NOT_APPROVED` | 403 | Collector not approved |
| `VALIDATION_ERROR` | 400 | Going online without a location |

<details><summary>Example: Going offline</summary>

```http
PUT /api/v1/collector/status
Authorization: Bearer <accessToken>
```

```json
{
  "online": false
}
```

`204` with no body.

</details>

### PUT /collector/location

Location ping, about every 30 seconds while online or on the way.

**Who:** Approved collector · **Since:** M2

- While the collector has an `ACCEPTED` pickup, its household gets `collector.location` (live map on H6).

**Request**

```http
PUT /api/v1/collector/location
Authorization: Bearer <accessToken>
```

```json
{
  "lat": 23.808,
  "lng": 90.3687
}
```

**Response**

`204` with no body.

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `NOT_APPROVED` | 403 | Collector not approved |

### GET /collector/requests/nearby

Open requests whose current radius reaches the given point, nearest first (screen C1).

**Who:** Approved collector · **Since:** M2

- Query: `lat`, `lng` (inside Bangladesh).
- Area and distance only; never the exact address or phone. Up to 50.
- `requestedAt` (C1's "নতুন" badge) and `expiresAt` (end of the booked slot) were added in M4.

**Request**

```http
GET /api/v1/collector/requests/nearby?lat=23.8091&lng=90.3687
Authorization: Bearer <accessToken>
```

**Response**

`200` (recorded 2026-11-16)

```json
[
  {
    "id": "476ead8e-6bae-494e-97c1-f94e09cb381a",
    "area": "Mirpur 10",
    "distanceM": 298,
    "categoryCodes": [
      "IRON",
      "NEWSPAPER"
    ],
    "weightBand": "FROM_5_TO_15",
    "slotDate": "2026-11-17",
    "slot": "MORNING",
    "hasPhoto": false,
    "estimate": {
      "min": 200,
      "max": 600
    },
    "requestedAt": "2026-11-16T13:33:48.842Z",
    "expiresAt": "2026-11-17T06:00:00.000Z"
  }
]
```

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `NOT_APPROVED` | 403 | Collector not approved |

## Admin

### GET /admin/collectors

Collector applications by verification status, oldest application first (A3; the screen arrives in M5).

**Who:** Admin · **Since:** M4

- Query: `status` (`PENDING`, `APPROVED`, `REJECTED`; all when left out), `limit` (1-50, default 20), `cursor`.

**Request**

```http
GET /api/v1/admin/collectors?status=PENDING&limit=5
Authorization: Bearer <accessToken>
```

**Response**

`200`

```json
{
  "items": [
    {
      "userId": "69985e76-2e4e-4412-b5fa-99bc7ac3fffb",
      "name": "Jasim Uddin",
      "phone": "+8801708955427",
      "nidNumberMasked": "19XX XX 4321",
      "nidVerified": false,
      "selfieUrl": "http://localhost:8333/bhangariwala-photos/selfies/69985e76-2e4e-4412-b5fa-99bc7ac3fffb/33ab0f6f-658b-47f7-929f-920f82c6b0b2.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&…&X-Amz-Signature=…",
      "workAreas": [
        "MIRPUR",
        "PALLABI"
      ],
      "vehicleType": "VAN",
      "hasScale": true,
      "verificationStatus": "PENDING",
      "verificationNote": null,
      "submittedAt": "2026-11-16T13:33:48.759Z",
      "decidedAt": null,
      "isOnline": false,
      "ratingAvg": null,
      "pickups30d": 0,
      "releases30d": 0
    }
  ],
  "nextCursor": null
}
```

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Bad status, limit or cursor |

### POST /admin/collectors/{userId}/decision

Approves or rejects a `PENDING` application. The collector gets an SMS in their language and the `collector.verification` event.

**Who:** Admin · **Since:** M4

- `note` (up to 500) is required when rejecting; the collector reads it on C7.
- Approval does not mark the NID card as checked (`nidVerified` stays false; card checks come later).

**Request**

```http
POST /api/v1/admin/collectors/{userId}/decision
Authorization: Bearer <accessToken>
```

```json
{
  "decision": "APPROVED"
}
```

**Response**

`204` with no body.

<details><summary>Example: Rejecting with a note</summary>

```json
{
  "decision": "REJECTED",
  "note": "The selfie is blurred. Take it again in daylight."
}
```

`204` with no body. SMS: "ভাঙ্গারিওয়ালা: আপনার সংগ্রাহক আবেদন এবার গ্রহণ করা যায়নি। কারণ দেখতে ও আবার আবেদন করতে অ্যাপ খুলুন।"

</details>

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Bad user id or decision, or rejecting without a note |
| `NOT_FOUND` | 404 | The user has not applied as a collector |
| `INVALID_STATE` | 409 | The application was already decided |


### POST /admin/pickups/{pickupId}/cancel

Cancels any active pickup (REQUESTED to CONFIRMED), with a reason. Closes an open dispute with outcome `CANCEL`.

**Who:** Admin · **Since:** M2

**Request**

```http
POST /api/v1/admin/pickups/167ce2e4-5a08-43d7-9e54-6c75335eccbe/cancel
Authorization: Bearer <accessToken>
```

```json
{
  "reason": "Duplicate request"
}
```

**Response**

`200`

```json
{
  "id": "167ce2e4-5a08-43d7-9e54-6c75335eccbe",
  "displayNo": "BW-1006",
  "status": "CANCELLED",
  "cancelledAt": "2026-11-14T11:40:11.164Z"
}
```

_Shortened to the fields this call changes; every pickup response has the full shape shown under [GET /pickups/{pickupId}](#get-pickupspickupid)._

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `INVALID_STATE` | 409 | Already finished |
| `VALIDATION_ERROR` | 400 | No reason |

### GET /admin/disputes

Disputes, open first (screen A4). Optional `status` = `REWEIGH`, `ADMIN_REVIEW` or `RESOLVED`.

**Who:** Admin · **Since:** M2

**Request**

```http
GET /api/v1/admin/disputes?status=ADMIN_REVIEW
Authorization: Bearer <accessToken>
```

**Response**

`200`

```json
[
  {
    "id": "a5c93535-1bba-4ed6-9c62-7fbeaabd6270",
    "pickupId": "7d5454fd-9794-4bdb-bea8-d34ac7b7e83f",
    "displayNo": "BW-1004",
    "type": "WEIGHT",
    "status": "ADMIN_REVIEW",
    "raisedBy": "68aca7b0-6e76-400a-989a-92376f21cc50",
    "reason": "Still too low",
    "photoIds": [],
    "outcome": null,
    "resolutionNote": null,
    "createdAt": "2026-11-14T11:40:10.824Z",
    "resolvedAt": null
  }
]
```

### POST /admin/disputes/{disputeId}/resolve

Closes a dispute in `ADMIN_REVIEW` with an outcome. Both sides get `dispute.resolved` with the note.

**Who:** Admin · **Since:** M2

- `WEIGHT`: `ACCEPT_WEIGHTS` (pickup back to `WEIGHED`; the household confirms), `TEAM_REWEIGH` (stays `DISPUTED` until an admin posts weights), `CANCEL`.
- `PAYMENT`: `PAYMENT_VERIFIED`, `PAY_AGAIN` (collector records a new TrxID), `SUSPEND_COLLECTOR`.
- `BEHAVIOUR`, `OTHER`: `NO_ACTION`, `SUSPEND_COLLECTOR`, `CANCEL` (only while the pickup is active).
- `SUSPEND_COLLECTOR` blocks the collector's account and takes them offline.

**Request**

```http
POST /api/v1/admin/disputes/a5c93535-1bba-4ed6-9c62-7fbeaabd6270/resolve
Authorization: Bearer <accessToken>
```

```json
{
  "outcome": "ACCEPT_WEIGHTS",
  "note": "The re-weighed amount, ৳925, is fair."
}
```

**Response**

`200`

```json
{
  "id": "a5c93535-1bba-4ed6-9c62-7fbeaabd6270",
  "pickupId": "7d5454fd-9794-4bdb-bea8-d34ac7b7e83f",
  "displayNo": "BW-1004",
  "type": "WEIGHT",
  "status": "RESOLVED",
  "raisedBy": "68aca7b0-6e76-400a-989a-92376f21cc50",
  "reason": "Still too low",
  "photoIds": [],
  "outcome": "ACCEPT_WEIGHTS",
  "resolutionNote": "The re-weighed amount, ৳925, is fair.",
  "createdAt": "2026-11-14T11:40:10.824Z",
  "resolvedAt": "2026-11-14T11:40:10.848Z"
}
```

**Example: Payment dispute**

Request:

```json
{
  "outcome": "PAYMENT_VERIFIED",
  "note": "Statement shows the transfer."
}
```

Response:

`200`

```json
{
  "id": "efbbfa65-6c30-4143-b086-4e3cd2dd620b",
  "pickupId": "7d5454fd-9794-4bdb-bea8-d34ac7b7e83f",
  "displayNo": "BW-1004",
  "type": "PAYMENT",
  "status": "RESOLVED",
  "raisedBy": "68aca7b0-6e76-400a-989a-92376f21cc50",
  "reason": "bKash message did not arrive",
  "photoIds": [],
  "outcome": "PAYMENT_VERIFIED",
  "resolutionNote": "Statement shows the transfer.",
  "createdAt": "2026-11-14T11:40:10.956Z",
  "resolvedAt": "2026-11-14T11:40:10.973Z"
}
```

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Outcome not allowed for the type, or no note |
| `INVALID_STATE` | 409 | Already resolved, or the collector is re-weighing |
| `NOT_FOUND` | 404 | Unknown dispute |

## Notifications

### GET /me/notifications

The household's notifications (H13), newest first. The feed is built from what already happened (status changes, resolved disputes, published rates), so it always matches the pickup history; there is nothing separate to keep in sync.

**Who:** Household (collectors get a feed in M4) · **Since:** M3

- Listed: a collector accepted (`PICKUP_ACCEPTED`), gave the request back (`PICKUP_RELEASED`), sent weights (`PICKUP_WEIGHED`, `data.weighVersion` > 1 for a re-weigh), was paid (`PICKUP_PAID`); a request expired (`PICKUP_EXPIRED`) or was cancelled by an admin (`PICKUP_CANCELLED`); a dispute was resolved (`DISPUTE_RESOLVED`, except re-weighs and cancels, which already appear); the day's rates were published (`RATES_PUBLISHED`, from the day the account was created).
- The household's own actions (request, confirm, dispute, cancel) are not listed.
- `data` carries only the facts for the type; the apps write the sentence in Bangla or English.
- `read` is `true` for items at or before the last [`POST /me/notifications/read`](#post-menotificationsread); `unreadCount` covers every page.
- Query: `limit` 1-50 (default 20); `cursor` from the previous page.

**Request**

```http
GET /api/v1/me/notifications?limit=2
Authorization: Bearer <accessToken>
```

**Response**

`200`

```json
{
  "items": [
    {
      "id": "se:35",
      "type": "PICKUP_PAID",
      "at": "2026-11-14T18:49:57.937Z",
      "read": false,
      "pickupId": "3e2fffe6-eab8-4b8a-b69a-d98fe3389299",
      "displayNo": "BW-1008",
      "data": {
        "categoryCodes": [
          "IRON",
          "NEWSPAPER"
        ],
        "collectorName": "Jasim Uddin",
        "method": "BKASH",
        "amount": 605
      }
    },
    {
      "id": "se:33",
      "type": "PICKUP_WEIGHED",
      "at": "2026-11-14T18:49:57.904Z",
      "read": false,
      "pickupId": "3e2fffe6-eab8-4b8a-b69a-d98fe3389299",
      "displayNo": "BW-1008",
      "data": {
        "categoryCodes": [
          "IRON",
          "NEWSPAPER"
        ],
        "collectorName": "Jasim Uddin",
        "weighVersion": 1,
        "totalKg": 14.5,
        "amount": 605
      }
    }
  ],
  "nextCursor": "MjAyNi0xMS0xNFQxODo0OTo1Ny45MDRafHNlOjMz",
  "unreadCount": 3
}
```

**Example: The next page**

`GET /api/v1/me/notifications?limit=2&cursor=…` → `200`

```json
{
  "items": [
    {
      "id": "se:31",
      "type": "PICKUP_ACCEPTED",
      "at": "2026-11-14T18:49:57.815Z",
      "read": false,
      "pickupId": "3e2fffe6-eab8-4b8a-b69a-d98fe3389299",
      "displayNo": "BW-1008",
      "data": {
        "categoryCodes": [
          "IRON",
          "NEWSPAPER"
        ],
        "collectorName": "Jasim Uddin"
      }
    }
  ],
  "nextCursor": null,
  "unreadCount": 3
}
```

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Bad cursor or limit |
| `FORBIDDEN` | 403 | Called by a collector or admin |

### POST /me/notifications/read

Marks every notification up to now as read (the H13 "সব পড়া হয়েছে" action).

**Who:** Household · **Since:** M3

**Request**

```http
POST /api/v1/me/notifications/read
Authorization: Bearer <accessToken>
```

**Response**

`204` (no body). Afterwards:

```json
{
  "items": [
    {
      "id": "se:35",
      "type": "PICKUP_PAID",
      "at": "2026-11-14T18:49:57.937Z",
      "read": true,
      "pickupId": "3e2fffe6-eab8-4b8a-b69a-d98fe3389299",
      "displayNo": "BW-1008",
      "data": {
        "categoryCodes": [
          "IRON",
          "NEWSPAPER"
        ],
        "collectorName": "Jasim Uddin",
        "method": "BKASH",
        "amount": 605
      }
    }
  ],
  "nextCursor": "MjAyNi0xMS0xNFQxODo0OTo1Ny45MzdafHNlOjM1",
  "unreadCount": 0
}
```

**Errors**

| Code | HTTP | When |
| --- | --- | --- |
| `FORBIDDEN` | 403 | Called by a collector or admin |

## Live events (Socket.IO)

Apps get pushed updates while open. Connect with Socket.IO to the API origin (not `/api/v1`), path `/socket.io`, and send the access token:

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', { auth: { token: accessToken } });
socket.on('ready', (me) => {/* rooms joined */});
socket.on('unauthorized', () => {/* refresh the token and reconnect */});
socket.on('pickup.accepted', (e) => {/* refetch GET /pickups/{e.pickupId} */});
```

Each user receives only their own events; admins receive every pickup event. Delivery is best effort, so refetch the pickup after a reconnect. Event names are in `SOCKET_EVENTS` (`@bw/shared`); payload shapes are the `Event*` schemas in the contract.

**Connection messages**

| Event | Payload |
| --- | --- |
| `ready` | `{"userId": "68aca7b0-6e76-400a-989a-92376f21cc50", "role": "HOUSEHOLD"}` |
| `unauthorized` (then disconnect) | `{"code": "UNAUTHORIZED", "message": "Sign in again: the access token is missing or expired."}` |

**Pickup events**

| Event | Who gets it | When |
| --- | --- | --- |
| `request.created` | Online approved collectors inside the radius (again for newly reached ones after widening or a release), and admins | A new open request; same shape as a nearby request, with this collector's distance |
| `request.taken` | Collectors who were sent the request | The request left the nearby list: `ACCEPTED`, `CANCELLED` or `EXPIRED` |
| `pickup.accepted` | Household, collector, admins | A collector accepted |
| `collector.location` | Household, while ACCEPTED | The collector's latest position |
| `pickup.released` | Household, the releasing collector, admins | The collector gave the request back |
| `pickup.arrived` | Household, collector, admins | The code matched |
| `pickup.weighed` | Household, collector, admins | A weigh round was saved (or an admin accepted the weights) |
| `pickup.disputed` | Household, collector, admins | The household rejected the weights |
| `pickup.confirmed` | Household, collector, admins | The household approved the weights |
| `pickup.paid` | Household, collector, admins | Payment recorded |
| `pickup.cancelled` | Household, collector, admins | Cancelled by the household or an admin |
| `dispute.opened` | Household, collector, admins | A dispute was opened (full `Dispute`) |
| `dispute.resolved` | Household, collector, admins | A dispute was closed (full `Dispute`) |
| `request.expired` | Household and admins | Nobody accepted before the slot ended |
| `pickup.code_locked` | Admins only | The 5th wrong pickup code |
| `collector.verification` | The collector, and admins | An admin approved or rejected the application (since M4) |

Every `pickup.*` event except `pickup.code_locked`, plus `request.expired`, has this one small shape; refetch the pickup for detail:

```json
{
  "pickupId": "7d5454fd-9794-4bdb-bea8-d34ac7b7e83f",
  "displayNo": "BW-1004",
  "status": "ACCEPTED",
  "at": "2026-11-14T11:40:10.436Z"
}
```

`request.created` (shape of a nearby request, with this collector's distance):

```json
{
  "id": "7d5454fd-9794-4bdb-bea8-d34ac7b7e83f",
  "area": "Mirpur 10",
  "distanceM": 244,
  "categoryCodes": [
    "IRON",
    "NEWSPAPER",
    "ELECTRONICS"
  ],
  "weightBand": "FROM_5_TO_15",
  "slotDate": "2026-11-15",
  "slot": "MORNING",
  "hasPhoto": false,
  "estimate": {
    "min": 200,
    "max": 600
  }
}
```

`request.taken`:

```json
{
  "pickupId": "7d5454fd-9794-4bdb-bea8-d34ac7b7e83f",
  "reason": "ACCEPTED"
}
```

`collector.location`:

```json
{
  "pickupId": "7d5454fd-9794-4bdb-bea8-d34ac7b7e83f",
  "lat": 23.808,
  "lng": 90.3687,
  "at": "2026-11-14T11:40:10.524Z"
}
```

`dispute.opened` and `dispute.resolved` carry the full `Dispute`:

```json
{
  "id": "d6259fd4-0b38-4581-9f6e-9c91417680af",
  "pickupId": "7d5454fd-9794-4bdb-bea8-d34ac7b7e83f",
  "displayNo": "BW-1004",
  "type": "WEIGHT",
  "status": "RESOLVED",
  "raisedBy": "68aca7b0-6e76-400a-989a-92376f21cc50",
  "reason": "লোহা অন্তত ১১ কেজি হবে",
  "photoIds": [],
  "outcome": "REWEIGHED",
  "resolutionNote": "Re-weighed: 18.0 kg, 925.00 taka",
  "createdAt": "2026-11-14T11:40:10.703Z",
  "resolvedAt": "2026-11-14T11:40:10.763Z"
}
```

`collector.verification` (the collector and admins):

```json
{
  "userId": "69985e76-2e4e-4412-b5fa-99bc7ac3fffb",
  "verificationStatus": "APPROVED",
  "verificationNote": null,
  "at": "2026-11-16T13:33:48.810Z"
}
```

`pickup.code_locked` (admins; shape from the contract, ids elided):

```json
{
  "pickupId": "…",
  "displayNo": "BW-1004",
  "collectorId": "…",
  "at": "2026-11-14T11:40:10.524Z"
}
```

## Planned endpoints

These are already in [`openapi.yaml`](openapi.yaml) but not served yet; calling them returns `404`.

| Method | Path | Milestone | Purpose |
| --- | --- | --- | --- |
| `GET` | `/admin/pickups` | M5 | Filter pickups by status, area and date |
| `GET` | `/admin/users` | M5 | Households or collectors, searchable |
| `PUT` | `/admin/users/{userId}/status` | M5 | Activate, flag or suspend a user |

Collectors for testing now go through the real flow: sign in with role `COLLECTOR`, `POST /collector/selfie` and `/collector/signup`, then an admin approves with `POST /admin/collectors/{userId}/decision`. The e2e helper `makeCollector` in `apps/api/test/pickup-helpers.ts` still inserts an approved profile directly, for speed.
