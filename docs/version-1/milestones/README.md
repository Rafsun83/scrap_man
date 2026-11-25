# Milestone notes: version 1

One note per finished milestone in version 1: what was built, how it was checked, and what is left open. Version 1 milestones are numbered V1-M1, V1-M2, and so on, so they are not confused with the version 0 milestones M0 to M7 (in [`../../version-0/milestones/`](../../version-0/milestones/README.md)). The same list is kept in [`CLAUDE.md`](../../../CLAUDE.md).

## Plan

Version 1 changes how the apps look, not what they do: no API or backend changes unless a screen needs new data, and then Rafsun decides first.

| Milestone | Work | Done when | Note | Status |
| --- | --- | --- | --- | --- |
| V1-M1 UI design | Style guide and all 30 screen designs on the canvas; copies in `docs/version-1/design/` | Designs published and copied to the repo | [V1-M1-ui-design.md](V1-M1-ui-design.md) | Done 2026-11-25 (full review by Rafsun open) |
| V1-M2 Shared style and components | Update tokens in `@bw/shared` (ground `#F5F6F2`, 4-6 px radius, grey `#8A97A3` selected/focus border). Rebuild the reusable pieces in `apps/mobile/src/ui`: buttons, inputs, cards, chips, tab bar, code boxes, weight steppers, with no animation | Existing screens already move toward the new look; all checks pass | [V1-M2-shared-style-components.md](V1-M2-shared-style-components.md) | Done 2026-11-25 (real-phone check at the start of V1-M3) |
| V1-M3 Household screens | Rebuild H1-H14 from `design/household/`, with loading, empty and error states | Every household screen matches its design; checked on a phone | [V1-M3-household-screens.md](V1-M3-household-screens.md) | Code done 2026-11-25 (phone walk-through pending) |
| V1-M4 Collector screens | Rebuild C1-C11 from `design/collector/`, with loading, empty and error states | Every collector screen matches its design; checked on a phone | [V1-M4-collector-screens.md](V1-M4-collector-screens.md) | Code done 2026-11-25 (phone walk-through pending) |
| V1-M5 Admin panel | Restyle A1-A5 in `apps/admin` from `design/admin/`: side menu, status cards, tables, forms | All five pages match their designs; operations walk-through done | | Not started |
| V1-M6 Polish and sign-off | Final pass on both apps: Bangla and English strings, 48 px touch targets, low-end Android check, fixes from Rafsun's review | Rafsun approves version 1 | | Not started |

## How each milestone ends

1. `pnpm turbo run lint typecheck test build` passes.
2. A note is added here (`V1-M<n>-<name>.md`) with the same layout as V1-M1: summary, checklist, verification, decisions, open items.
3. The row above is updated, and the matching line in `CLAUDE.md` is ticked.
4. Rafsun gets a report and gives the go-ahead before the next milestone starts.
