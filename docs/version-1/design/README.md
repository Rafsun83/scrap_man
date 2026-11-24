# Design: version 1

The version 1 redesign of every screen: 14 household, 11 collector and 5 admin. It keeps the brand colours and fonts from version 0 but uses them more quietly. The live, clickable canvas is https://claude.ai/artifact/Jji2UM9r8TGmWdzVMrgkim (private to Rafsun's account until shared).

Each `.dc.html` file is one screen made in the canvas tool. Like the version 0 prototype, the files need the canvas runtime (`support.js`, not included) to render, so read them as a reference for layout, colours, sizes and copy, or open the canvas link.

## Layout of this folder

| Path | What it is |
| --- | --- |
| `StyleGuide.dc.html` | Colours, type, input states, chips and buttons (the `Main` board on the canvas) |
| `household/` | H1 to H14 |
| `collector/` | C1 to C11 (files start with `C`) |
| `admin/` | A1 to A5 (files start with `Admin`) |
| `canvas.json` | The canvas index: board positions, titles and section headings. It lists files by name only; on the canvas they sit side by side, here they are split into the folders above |
| `questions.md` | The planning questions asked before the design started |

## Style rules (decided 2026-11-24)

- **No animation.** Selecting a card or typing in a field does not move, scale, glow or change shadow.
- **Selected or focused = plain grey border.** `#8A97A3`, 1.5 px. The resting border is `#E3E6E0`.
- **Corner radius 4 to 6 px.** 6 px on cards, inputs, buttons, chips and the tab bar; 4 px on small icon tiles, code boxes and tags. Only true circles (radio buttons, dots) stay round.
- **Colours:** ground `#F5F6F2`, white cards with a light shadow, ink `#13304A` for text and main buttons, muted ink `#5B6B7A` for secondary text, signal yellow `#FFC72C` only for the one key action on a screen, money green `#0B7A5C` only for taka and success, alert `#A63D16` only for errors and destructive actions.
- **Type:** Anek Bangla for headings and amounts (600/700), Hind Siliguri for body and labels (400/500/600). Body 15 to 16 px, labels 14 px.
- **Sizes:** inputs and main buttons 56 px tall; every touch target at least 44 to 48 px; every action has an icon and text.
- **Static states only.** The "finding a collector" screen uses still rings, not a moving radar.

## Household app

| ID | Screen | File |
| --- | --- | --- |
| H1 | Sign in | `household/SignIn.dc.html` |
| H9 | Verify phone | `household/OTP.dc.html` |
| H2 | Home | `household/Home.dc.html` |
| H12 | All rates | `household/Rates.dc.html` |
| H3 | Select items | `household/SelectItems.dc.html` |
| H4 | Schedule pickup | `household/Schedule.dc.html` |
| H5 | Finding a collector | `household/Searching.dc.html` |
| H6 | Collector on the way | `household/Tracking.dc.html` |
| H7 | Confirm weight | `household/ConfirmWeight.dc.html` |
| H14 | Report a problem | `household/ReportProblem.dc.html` |
| H8 | Paid | `household/Receipt.dc.html` |
| H11 | Pickup history | `household/History.dc.html` |
| H13 | Notifications | `household/Notifications.dc.html` |
| H10 | Profile and addresses | `household/Profile.dc.html` |

## Collector app

| ID | Screen | File |
| --- | --- | --- |
| C6 | Sign up | `collector/CSignup.dc.html` |
| C7 | Waiting for approval | `collector/CPending.dc.html` |
| C1 | Nearby requests | `collector/CHome.dc.html` |
| C2 | Request detail | `collector/CRequest.dc.html` |
| C3 | Arrive and verify | `collector/CActive.dc.html` |
| C4 | Weigh items | `collector/CWeigh.dc.html` |
| C10 | Re-weigh after a dispute | `collector/CReweigh.dc.html` |
| C5 | Pay and complete | `collector/CPay.dc.html` |
| C8 | My pickups | `collector/CPickups.dc.html` |
| C9 | Ledger | `collector/CLedger.dc.html` |
| C11 | Profile | `collector/CProfile.dc.html` |

## Admin panel

English first, with a বাংলা button in the top bar. Fluid pages designed at 1440 wide; the side menu stacks above the content at phone width.

| ID | Page | File |
| --- | --- | --- |
| A1 | Live pickups | `admin/AdminPickups.dc.html` |
| A2 | Daily rates | `admin/AdminRates.dc.html` |
| A3 | Collector approvals | `admin/AdminCollectors.dc.html` |
| A4 | Disputes | `admin/AdminDisputes.dc.html` |
| A5 | Users | `admin/AdminUsers.dc.html` |

## Notes for building

- Names, phone numbers, NID numbers, rates and amounts are sample data.
- Bangla copy comes from the version 0 prototype; move every string into the translation files with an English version.
- The scale photo is optional on both C4 and C10 (decision of 2026-11-21); the version 0 prototype still showed it as required on C10.
- Loading, empty and error states: only some are drawn (History "active" filter, Nearby requests offline). The rest still need designing during the build.
