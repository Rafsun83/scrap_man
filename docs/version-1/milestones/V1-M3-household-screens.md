# V1-M3 Household screens

**Finished:** 2026-11-25 · **Status:** code done and checked; **the phone walk-through is still pending.**

All 14 household screens (H1-H14) now follow the version 1 designs in `docs/version-1/design/household/`. The app is also free of motion: screen changes, bottom sheets and the photo viewer no longer slide or fade, and the "finding a collector" radar no longer pulses.

## Checklist

### No animation anywhere (asked by Rafsun on 2026-11-25)
- [x] Stack screens: `animation: 'none'` in `app/_layout.tsx`, `(auth)`, `(household)` and `(collector)` layouts
- [x] Modals (scale photo, collector sheets): `animationType="none"`
- [x] H5 radar: the `Animated` pulse removed; still rings
- [x] Address "default" switch: the platform `Switch` (which slides) replaced by a static `Toggle`

### New shared parts (`src/ui/parts.tsx`, reused by V1-M4)
- [x] `IconTile`, `Badge` (done, warn, alert, neutral, ink), `ProgressBar`, `SelectCard`, `SectionLabel`, `StatCard`, `DashedButton`, `Toggle`
- [x] `categoryLook()`: icon and tile tint per category (`iron`, `newspaper`, `bottle`, `carton`, `can`, `device`)
- [x] `rateChangeTag()` in `src/household/RateBoard.tsx`: "▲ ৳২" / "▼ ৳১" / "—"

### Screens
- [x] **H1 Sign in:** app icon, "স্বাগতম", phone field with `+৮৮০` prefix (grey border while typing), two role cards with icon tiles, language button, ink "কোড পাঠান"
- [x] **H9 Verify phone:** no badge; `CodeBoxes`; warning note for "never share the code"
- [x] **H2 Home:** greeting and name, bell with a yellow dot, ink welcome card with the yellow key "ভাঙ্গারি বিক্রি করুন", active-pickup card, two-column rate tiles with change tags, recent sales with green tiles
- [x] **H12 All rates:** one white list with icon tiles, change tags and prices; rate-lock note; yellow key button
- [x] **H3 Select items:** thin progress bar; item cards with icon tiles and grey selection border (no tick); weight chips; dashed photo button
- [x] **H4 Schedule:** address card with pin tile; white day buttons; slot rows; note field; items as tags; estimated earnings in the footer above the send button
- [x] **H5 Finding a collector:** still rings, live collector dots kept, request summary, cancel
- [x] **H6 Collector on the way:** white collector card with call button; pickup code in four boxes on a white card with an ink border; ETA tag; quieter progress steps
- [x] **H7 Confirm weight:** two white totals cards; breakdown card with "পাল্লার ছবি দেখুন" in its header; cash / bKash / Nagad as three tiles
- [x] **H14 Report a problem:** reason rows, details field, dashed photo button
- [x] **H8 Paid:** green tile and amount, receipt card with a dashed total rule, rating card with grey and yellow stars
- [x] **H11 Pickup history:** white totals cards, filter chips, white rows with badges, empty state with the yellow key button
- [x] **H13 Notifications:** unread as white cards with tinted icon tiles and a yellow dot; read as outlined rows
- [x] **H10 Profile:** ink square avatar, address rows with tiles and a "মূল ঠিকানা" badge, settings card, log out
- [x] Disputed, waiting-for-payment and ended pickup views and the address form match the same style

### Strings (`@bw/shared` `i18n.ts`, Bangla and English)
- [x] `signInWelcome`, `roleHouseholdSub`, `roleCollectorSub`, `homeHeroTitle`, `seeAll`, `perKgSuffix`

## Verification

| Check | Result |
| --- | --- |
| `pnpm turbo run lint typecheck test build` | 17 of 17 tasks pass |
| Mobile tests | 109 pass (106 before, plus 3 in `src/ui/parts.test.tsx`: select card border and checked state, toggle, progress bar). The H6 test now checks the four code boxes instead of one text |
| Android bundle (`npx expo export --platform android`) | Builds; every import and the icon image resolve |
| Phone walk-through | **Pending:** needs Rafsun's phone (`pnpm dev:mobile`, then sign in as a household and go through H1 to H14) |

## Decisions

- Back actions keep icon plus text ("ফিরে যান"), as CLAUDE.md requires, instead of the icon-only square in the designs.
- H5 keeps the live collector dots on the rings (real data); only the pulse is gone.
- H7 payment choice is three tiles as in the design; the wallet number field still appears below for bKash and Nagad.
- The H1 terms line from the design is left out until the terms content exists (M7).
- The progress bar is now announced by screen readers (`accessible`).

## Open items

- Phone walk-through of H1-H14 on a real Android phone, including a low-end one.
- Collector screens (V1-M4) still use the old navy headers; they share the new parts from here.
