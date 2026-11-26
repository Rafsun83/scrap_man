# V1-M6 Polish and sign-off

**Started:** 2026-11-26 · **Status:** code pass done; **waiting for Rafsun's review, the phone walk-throughs and a low-end Android check.** This milestone is done when Rafsun approves version 1.

A final pass on the mobile app (households and collectors) and the admin panel, looking for strings outside the translation files, touch targets under the minimum, and screens that could be slow on a cheap phone.

## Checklist

### Bangla and English strings
- [x] No hard-coded user-facing text in `apps/mobile` or `apps/admin`: no JSX text, labels, placeholders or alerts outside `@bw/shared` (the only literals left are the brand name, the OpenStreetMap credit and the Android notification channel name)
- [x] Every Bangla value is translated: no Bangla value left in English, no English value with Bangla in it, no ASCII digits in Bangla values (checked across app, admin and landing strings). Intended exceptions: "English" on the language switch, "TrxID", and the landing page's "Switch to English" label
- [x] Key parity and matching placeholders in both languages (existing tests in `@bw/shared`)
- [x] 13 strings no version 1 screen uses removed from `i18n.ts` (old version 0 sign-in points, server status, "see all rates" and others). Each was checked against the version 1 designs first. `tagline` and `collectorAgreement` are kept for the launch content (M7)

### Touch targets (mobile 48 px, admin 44 px)
- [x] Every `Pressable` in the mobile app checked
- [x] H2 home: the address link above the greeting was 36 px tall, now 48 px
- [x] C4/C10 weigh: the remove-item button was 32 px wide and relied on `hitSlop`; it is now a real 48 × 48 px target
- [x] On/off switch (address "make default"): 50 × 30 px visual with `hitSlop`; it is now a 48 px target with the same visual inside it
- [x] Admin: small buttons (View, Close, Call, Sign out) raised from 40 to 44 px

### Low-end Android
- [x] C9 ledger: a month could draw hundreds of payment rows at once; it now shows 20 at a time with a "load more" button (আরও দেখুন), and starts again from 20 when the range changes
- [x] C9 ledger: the week and month views now show the date with each payment (they showed the time only)
- [x] Long lists already use `FlatList`/`SectionList` (C1 requests, C8 my pickups, H11 history, notifications)
- [x] Android bundle builds (`npx expo export --platform android`, Hermes bundle 3.3 MB)
- [ ] **Pending:** run both apps on a low-end Android phone (2-3 GB RAM): scrolling C1, H11 and C9, the map on H6, the camera on C4 and H14

### Review and walk-throughs
- [ ] **Pending:** Rafsun's review of version 1 and the fixes from it
- [ ] **Pending:** phone walk-through of the household screens (V1-M3) and collector screens (V1-M4)
- [ ] **Pending:** admin operations walk-through (V1-M5), including selfies and scale photos loading

## Verification

| Check | Result |
| --- | --- |
| `pnpm turbo run lint typecheck test build` | 17 of 17 tasks pass |
| Mobile tests | 110 pass (one new: C9 ledger paging and dates; the switch test now also checks the 48 px target) |
| Admin tests | 30 pass |
| Shared tests | 19 pass |
| Android bundle | Builds |

## Decisions

- The remove-item button on C4/C10 stays icon only (trash) with a spoken label, as in the design; it is a small secondary control inside an item card.
- C11 still has no "collector agreement" and "notifications" rows (in the design); they need the agreement text and the push setup from M7.

## Open items

- Low-end Android check, phone walk-throughs, admin operations walk-through.
- Rafsun's review; fixes go into this milestone.
