# V1-M1 UI design

**Finished:** 2026-11-25 · **Status:** designs done and approved style; **not built in `apps/mobile` or `apps/admin` yet.**

Version 1 redesigns every screen for a calm, simple, elegant look. This milestone produced the designs only: a style guide and all 30 screens (14 household, 11 collector, 5 admin) on a clickable canvas, with copies in this repo.

- Live canvas: https://claude.ai/artifact/Jji2UM9r8TGmWdzVMrgkim
- Repo copies and screen index: [`../design/README.md`](../design/README.md)

## Checklist

### Planning
- [x] `docs/version-0/` holds everything up to M7; `docs/version-1/` started for this round (`docs/README.md` explains versions)
- [x] Planning questions saved in `design/questions.md`

### Style (decided with Rafsun, 2026-11-24)
- [x] Brand colours and fonts kept (ink, signal yellow, money green, alert; Anek Bangla and Hind Siliguri), used more sparingly on a softer ground `#F5F6F2`
- [x] No animation on selecting cards or typing (no transitions, press scale, focus glow or shadow change)
- [x] Selected and focused state is a plain grey border (`#8A97A3`); resting border `#E3E6E0`
- [x] Corner radius 4 to 6 px everywhere except true circles
- [x] Style guide board: colours, type scale, input states (default, typing/selected, error), chips, buttons

### Household app (H1 to H14), `design/household/`
- [x] H1 Sign in: `+৮৮০` phone field, sell/collect role cards
- [x] H9 Verify phone: six code boxes, resend timer, "never share the code" warning
- [x] H2 Home: welcome card with the yellow sell action, today's rate tiles, recent sale, tab bar (হোম, বিক্রি, ইতিহাস, প্রোফাইল)
- [x] H12 All rates: one list with change from yesterday, electronics "দেখে দর", rate-lock note
- [x] H3 Select items: multi-select item cards, weight band, optional photo, selected count
- [x] H4 Schedule pickup: address, day chips, time slots, note, estimated earnings
- [x] H5 Finding a collector: still rings (no moving radar), request summary, cancel
- [x] H6 Collector on the way: drawn map, collector card with call, 4-digit pickup code, progress steps
- [x] H7 Confirm weight: totals, line-by-line calculation, scale photo link, cash/bKash/Nagad choice, report problem
- [x] H14 Report a problem: four reasons, details, optional photo
- [x] H8 Paid: amount received, receipt, 1 to 5 star rating
- [x] H11 Pickup history: totals, all/active/done/cancelled filters, empty state
- [x] H13 Notifications: today and earlier, unread dot
- [x] H10 Profile: saved addresses, language switch, notification switch, help, terms, log out

### Collector app (C1 to C11), `design/collector/`
- [x] C6 Sign up: name, verified phone, NID number, selfie, work areas, vehicle, own scale, agreement
- [x] C7 Waiting for approval: three steps with the current one marked, application summary, call support
- [x] C1 Nearby requests: online/offline switch with offline empty state, today's totals, request cards with area and distance only
- [x] C2 Request detail: address-locked note, time and weight, items at today's rates, estimate, skip or accept
- [x] C3 Arrive and verify: full address and note after accept, call and directions, 4-digit code entry, "customer not found"
- [x] C4 Weigh items: −/+ steppers in 0.5 kg steps, live totals, add item, optional scale photo
- [x] C10 Re-weigh: household's complaint, earlier weights, changed weights marked, new total, optional photo
- [x] C5 Pay and complete: amount, household's bKash number with copy, TrxID field
- [x] C8 My pickups: today, upcoming, past tabs
- [x] C9 Ledger: today/week/month totals, kg per item bars, cash and bKash split, today's payments
- [x] C11 Profile: rating, work details, verification status, settings, log out

### Admin panel (A1 to A5), `design/admin/`
- [x] Shared layout: white side menu with approval and dispute counts, staff name, বাংলা button; stacks at phone width
- [x] A1 Live pickups: status count cards that filter the table, needs-attention list, search and area filter, map with legend
- [x] A2 Daily rates: editable rates with change from yesterday, unpublished-changes banner, publish, copy yesterday
- [x] A3 Collector approvals: applicant list, selfie and details, three checks (approve stays grey until all ticked), note, approve or reject
- [x] A4 Disputes: weight dispute (reason, weigh rounds, scale photos, timeline) and payment dispute (amount, method, TrxID), resolution choices, resolve
- [x] A5 Users: households and collectors tabs; release flag above 5 in 30 days

### Repo
- [x] All screens copied to `docs/version-1/design/` in `household/`, `collector/` and `admin/`, with `StyleGuide.dc.html` and `canvas.json`
- [x] Screen index and style rules in `docs/version-1/design/README.md`

## Verification

| Check | Result |
| --- | --- |
| Every screen published to the canvas | 31 boards (style guide plus 30 screens), each published and accepted |
| Clickable flows on the canvas (Play) | Household: sign in, OTP, home, select items, schedule, searching; confirm weight to paid or report. Collector: sign up, pending, requests, detail, arrive, weigh, pay. Admin: side menu links between all five pages |
| Interactive parts on the canvas | Selections, filters, tabs, steppers with live totals, switches and rate inputs work in Play |
| Screen-by-screen review by Rafsun | Style approved after the first samples (no animation, grey border, 4 to 6 px corners); full review of all 30 screens pending |
| Code checks (`pnpm turbo run lint typecheck test build`) | Not run: no app code changed in this milestone |

## Decisions

- Version 1 milestones are numbered V1-M1, V1-M2 and so on.
- File names on the canvas are flat (`SignIn.dc.html`, `CHome.dc.html`, `AdminUsers.dc.html`). In the repo they are split into folders; the canvas board `Main` is `StyleGuide.dc.html` here.
- Admin pages are English first with a Bangla toggle, as in version 0.
- The scale photo stays optional on re-weigh too (2026-11-21 decision), unlike the version 0 prototype.

## Open items

- Rafsun's review of all 30 screens, and any changes from it.
- Loading and error states for most screens, plus empty states beyond the two drawn.
- Building the designs: `apps/mobile` (household and collector) and `apps/admin`, with shared tokens (radius, borders, ground colour) updated in `@bw/shared`.
- Collector sign-up is not linked from the household sign-in "সংগ্রহ করব" card on the canvas.
