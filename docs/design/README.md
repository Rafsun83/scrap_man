# Design: the BhangariWala prototype

These are the source files of the clickable prototype (35 boards). Each `.dc.html` file is one screen: its HTML and inline styles give the exact layout, colours, sizes and Bangla copy to build from. They were made in a canvas tool and need its runtime (`support.js`, not included) to render, so read them as a reference rather than opening them in a browser. Rafsun can show the live, clickable version on claude.ai.

## Rules for building from them

- Phone screens are 390 x 844. Admin pages are fluid web pages designed at 1440 wide.
- Colours, fonts and radii match `packages/shared/src/theme.ts`: ink `#13304A`, signal yellow `#FFC72C`, money green `#0B7A5C`, ground `#EEF0EC`, alert `#A63D16`, gamcha red `#D9483B`. Display font Anek Bangla, body Hind Siliguri.
- Bangla copy in the files is the wording to use; move every string into the translation files with an English version.
- Names, phone numbers, rates and amounts are sample data, not real values.
- Dashed "ডেমো" chips are prototype-only shortcuts for steps that happen automatically in the real app (a collector accepting, weights arriving, admin approval). Do not build them.
- Every screen also needs loading, empty and error states, which the prototype mostly leaves out.

## Household app

| ID | Screen | File | What it does |
| --- | --- | --- | --- |
| H1 | Sign in | `Main.dc.html` | Phone number and role (sell / collector), sends the OTP |
| H9 | Verify phone | `OTP.dc.html` | 6-digit code, resend timer, "never share this code" |
| H2 | Home | `Home.dc.html` | Today's rate board, big "sell scrap" action, recent sales, tab bar |
| H12 | All rates | `Rates.dc.html` | Every category's rate and change from yesterday; rate-lock note |
| H3 | Select items | `SelectItems.dc.html` | Category cards (multi-select), weight band, optional photo |
| H4 | Schedule pickup | `Schedule.dc.html` | Address, note for collector, day and time slot, estimated earnings |
| H5 | Finding a collector | `Searching.dc.html` | Waiting state while nearby collectors see the request; cancel |
| H6 | Collector on the way | `Tracking.dc.html` | Map, collector card, call, 4-digit pickup code, progress steps |
| H7 | Confirm weight | `ConfirmWeight.dc.html` | Weigh lines (kg x rate), total, scale photo, payment method, report problem |
| H14 | Report a problem | `ReportProblem.dc.html` | Weight, payment not received, behaviour, other; details; photo |
| H8 | Paid | `Receipt.dc.html` | Amount received, receipt lines, star rating |
| H11 | Pickup history | `History.dc.html` | Totals, filters (all, active, done, cancelled), past pickups, empty state |
| H13 | Notifications | `Notifications.dc.html` | Payment, accepted, rate published, expired |
| H10 | Profile and addresses | `Profile.dc.html` | Saved addresses (default), language, help, terms, log out |

## Collector app

| ID | Screen | File | What it does |
| --- | --- | --- | --- |
| C6 | Sign up | `CollectorSignup.dc.html` | Name, verified phone, NID number, selfie, work areas, vehicle, scale, agreement |
| C7 | Waiting for approval | `CollectorPending.dc.html` | Application steps and status, call support |
| C1 | Nearby requests | `CollectorHome.dc.html` | Online switch, today's totals, request cards (area, distance, items, slot, weight band) |
| C2 | Request detail | `RequestDetail.dc.html` | Approximate area only, items with today's rates, estimate, accept or skip |
| C3 | Arrive and verify | `ActivePickup.dc.html` | Full address and note after accept, call, directions, enter the pickup code |
| C4 | Weigh items | `WeighEntry.dc.html` | Kg steppers per item (0.5 steps, 0.1 precision), optional scale photo, live total |
| C10 | Re-weigh after a dispute | `Reweigh.dc.html` | Household's reason, previous weights, new weights, required new photo |
| C5 | Pay and complete | `CollectorPay.dc.html` | Household confirmed, amount, method and wallet number, TrxID entry |
| C8 | My pickups | `MyPickups.dc.html` | Today, upcoming, past |
| C9 | Ledger | `Ledger.dc.html` | Paid out, kg collected and pickups by day, week, month; payments list |
| C11 | Profile | `CollectorProfile.dc.html` | Rating, work details, verification status, settings, log out |

## Admin panel

| ID | Screen | File | What it does |
| --- | --- | --- | --- |
| A1 | Live pickups | `AdminPickups.dc.html` | Status counts as filters, needs-attention list, pickups table, map |
| A2 | Daily rates | `AdminRates.dc.html` | Edit today's rates, change from yesterday, unpublished-changes banner, publish |
| A3 | Collector approvals | `AdminCollectors.dc.html` | Applicant list, selfie, NID number, checks, approve or reject |
| A4 | Disputes | `AdminDisputes.dc.html` | Weight and payment disputes, timeline, weigh rounds, resolution options |
| A5 | Users | `AdminUsers.dc.html` | Households and collectors tabs, status, releases flag |

## Logos

Boards L1 to L5 (`LogoBadge`, `LogoSignboard`, `LogoIcon`, `LogoSack`, `LogoFront`) are the logo options. Ready-made PNGs are in `logos/`. The app icon and splash in `apps/mobile/assets` come from L3 and L5.
