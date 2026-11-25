# V1-M4 Collector screens

**Finished:** 2026-11-25 · **Status:** code done and checked; **the phone walk-through is still pending.**

All 11 collector screens (C1-C11) now follow the version 1 designs in `docs/version-1/design/collector/`. The navy headers and yellow-on-navy figures are gone. Collector screens use the same light pages, white cards, grey selection border and 4-6 px corners as the household app. There is no animation.

## Checklist

### Shared collector pieces (`src/collector/ui.tsx`, `src/collector/job/parts.tsx`)
- [x] `NavyHeader` replaced by a light **`PageHeader`** (back with icon and text, ink title, muted sub, right slot); the top safe area is the ground colour
- [x] **`StatTile`**: white card with a light shadow, ink or money-green figure
- [x] **`Tag`**: 4 px tag on the ground colour; the `signal` tone is a yellow tint
- [x] **`TotalsLabelCard`**: two white totals cards (weight in ink, money in green)
- [x] **`VehiclePicker`**: three tiles in a row (`SelectCard`) instead of radio rows
- [x] `cs.section` cards get the light shadow; section titles are muted 14 px labels; `KeyValue` uses the lighter divider

### Screens
- [x] **C1 Nearby requests:** greeting, white bell with a yellow dot, white online switch with a green or grey dot (grey border when online), three white totals cards, current-job card, white request cards with "নতুন" and "ছবি আছে" tags and the distance
- [x] **C2 Request detail:** time and weight as two small cards, items with today's rates, the estimate in green under a dashed rule, skip (outline) and yellow key "গ্রহণ করুন"
- [x] **C3 Arrive and verify:** customer card with shadow, outlined code card with `CodeBoxes`; help, no-show and release sheet with 6 px corners
- [x] **C4 Weigh items / C10 Re-weigh:** item cards with `Stepper`, amounts in ink, dispute note in the alert tint, dashed "add item" and "scale photo (optional)" buttons, white totals cards
- [x] **C5 Pay and complete:** white amount card (green), outlined method card with the method tag and the wallet number, TrxID field
- [x] **C6 Sign up:** muted section labels, verified phone with a green tag, dashed selfie button, area chips, vehicle tiles, square check boxes
- [x] **C7 Waiting for approval:** tile icon, steps with an "চলছে" tag, application summary
- [x] **C8 My pickups:** white rows with status tags; the active pickup has the grey border
- [x] **C9 Ledger:** light header, range chips, white totals cards, kg per item as bars, payment-method tags, payments list
- [x] **C11 Profile:** ink square avatar, two white stat cards (rating with a star, pickups in 30 days), work details, verification, settings, log out
- [x] Work-details editor, status screens (waiting for confirm, under review, done, ended) and the collector inbox match the same style
- [x] Address map picker corner 6 px

## Verification

| Check | Result |
| --- | --- |
| `pnpm turbo run lint typecheck test build` | 17 of 17 tasks pass |
| Mobile tests | 109 pass, unchanged; the arrive, weigh, re-weigh and pay tests keep their test ids |
| Android bundle (`npx expo export --platform android`) | Builds |
| Leftover check | No navy text tones, old tints or corners above 6 px remain, except true circles (dots, step rings, map pin) |
| Phone walk-through | **Pending:** sign in as a collector and go from sign-up (C6) to payment (C5), then C8, C9, C11 |

## Decisions

- Back actions keep icon plus text (CLAUDE.md), as in V1-M3.
- The C1 online switch is a white button with a coloured dot instead of a sliding track, so nothing moves.
- C2 "accept" is the yellow key action, as in the design; C5 "paid" stays ink.
- C10 photo stays optional (2026-11-21 decision).

## Open items

- Phone walk-through of C1-C11, including a low-end Android phone.
- Household sign-in "সংগ্রহ করব" leads to collector sign-up through the normal flow (sign in, then join); no extra link needed.
