# V1-M5 Admin panel

**Finished:** 2026-11-26 · **Status:** code done and checked in a browser; **the operations walk-through is still pending.**

The five admin pages (A1-A5) in `apps/admin` now follow the version 1 designs in `docs/version-1/design/admin/`. The navy sidebar is replaced by a white side menu. Pages sit on the `#F5F6F2` ground with white cards and a light shadow. Corners are 6 px (4 px on tags), and anything selected or focused gets a plain grey `#8A97A3` border. Nothing animates. No API or backend changes.

## Checklist

### Shared pieces
- [x] **Stylesheet** (`src/index.css`) rewritten with the version 1 tokens: ground, resting border `#E3E6E0`, focus/selected `#8A97A3`, ink and muted ink, money green and alert only for taka/success and errors, 6 px / 4 px corners, card shadow
- [x] **Icons** (`src/components/Icon.tsx`): the line icons from the designs replace the text glyphs (✓ → ☎ ⇄ …); every action has an icon and text
- [x] **Buttons**: main action in ink (grey when disabled), outline, red-text "danger", link; `icon` prop on `Button`
- [x] **Side menu** (`Layout.tsx`): logo, five links with icons, the active page on a light blue-grey, 4 px count tags (applications yellow, disputes red), admin avatar with initials, sign out. It stacks above the content at phone width
- [x] **`PageHead`**: date line or sub line, title, the page's actions, and the বাংলা / English button at the end (the design's top-bar language button)
- [x] **Status tags**: requested yellow, accepted blue-grey, in progress grey, disputed red, completed green, cancelled/expired muted
- [x] **`Banner`**: warn, alert and ok banners with an icon and a thin border
- [x] Check boxes (square, grey when ticked) and radio cards (grey ring and border when chosen) without browser styling
- [x] Tabs and chips: white, 44 px, grey border when chosen
- [x] Drawer, sign-in card, team weigh form and weigh-rounds table in the same style; Leaflet zoom, fade and marker animations turned off

### Pages
- [x] **A1 Live pickups:** date line and title; search with icon, area filter, language; six count cards (disputed in red, completed in green) as filters; alerts and "needs attention" in red-bordered cards; pickups table with the area under the household and "Updated" on the right; map card with legend
- [x] **A2 Daily rates:** narrower page; date, "copy previous rates", "publish rates" in ink; unpublished/published banners; rate fields with ৳ inside and a grey border once changed; change as a green/red/grey tag; electronics "on inspection"; footer note under the card
- [x] **A3 Collector approvals:** Pending / Approved / Rejected tabs; applicant list card ("Applicants · n") with initials tiles; detail card with 148×180 selfie, two-column facts, checks fieldset, note, Reject (outline) and Approve (ink) on the right
- [x] **A4 Disputes:** Open / Resolved tabs and type filter; list card ("Open · n") with type tags; one detail card: title with status, parties, call buttons, the household's reason in a red-tinted box, weigh rounds table (last total in green), payment tiles, scale photos beside the timeline, resolution radio cards, note, "Resolve dispute" in ink
- [x] **A5 Users:** search with icon; Households / Collectors tabs; table card with names bold, phone and joined muted, totals in green, status tags, "View" link; releases above the limit shown as a red tag; the flag note under the card
- [x] Loading, empty and error states keep the same components, inside cards

## Verification

| Check | Result |
| --- | --- |
| `pnpm turbo run lint typecheck test build` | 17 of 17 tasks pass |
| Admin tests | 30 pass (29 kept unchanged, plus one new for avatar initials) |
| Browser check | All five pages screenshotted against the local API at 1440 px in English, A3 in Bangla, and A1 and sign-in at 390 px: side menu stacks, table scrolls inside its card |
| Operations walk-through | **Pending:** sign in as admin, publish rates, approve a collector, follow a pickup on A1, resolve a weight and a payment dispute, suspend a user |

## Decisions

- The language button sits at the end of each page's header row (as on the A1 design) rather than in a separate top bar, so no row is left empty.
- The area filter on A1 stays a text field with suggestions (`WORK_AREAS`), not a fixed select, so sub-areas such as "Mirpur 10" still filter.
- The yellow signal colour is not used for buttons in the admin panel; the designs use ink for the main action.
- Extra data the designs do not show is kept: the A1 alerts card, the A2 date picker and publisher line, the A3 status tabs, the A4 open/resolved tabs and type filter, the A5 no-shows column.

## Open items

- Operations walk-through with real data.
- The selfie and scale photo images did not load in the local check (local storage links); the boxes and alt text show in their place. Worth confirming on the walk-through.
