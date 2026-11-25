# V1-M2 Shared style and components

**Finished:** 2026-11-25 · **Status:** code done and checked; **not yet seen on a real phone.**

The version 1 style now lives in the shared tokens and the reusable mobile building blocks. Every screen that uses them already moves toward the new look: softer ground, white cards, ink main buttons, grey selection border, 4-6 px corners, no press effect. The screens themselves are rebuilt in V1-M3 (household) and V1-M4 (collector).

## Checklist

### Shared tokens (`packages/shared/src/theme.ts`)
- [x] `colors.ground` `#EEF0EC` → `#F5F6F2`; `colors.line` `#D5D9D3` → `#E3E6E0`; `colors.muted` `#4F5B66` → `#5B6B7A` (still 5:1 on the ground)
- [x] New `colors.selected` `#8A97A3` (selected or focused border) and `colors.divider` `#EDEFEA` (rule between rows)
- [x] `radius` is now `{ sm: 4, md: 6, lg: 6, round: 999 }`; `pill` removed
- [x] New `borderWidth` (1.5)
- [x] Admin and landing page only read `colors.ink` and `colors.signal`, which did not change

### Mobile theme (`apps/mobile/src/ui/theme.ts`)
- [x] `cardShadow`: one light shadow (elevation 1, cheap on low-end Android)
- [x] New tones: `inkTint` (active tab), `warnBg/warnLine/warnInk`, `alertBg/alertLine`; `dashed` and `ring` moved to `#C9CFC6`

### Building blocks (`apps/mobile/src/ui/components.tsx`)
- [x] **No press effect anywhere:** the pressed-opacity style is gone; a control looks the same while touched
- [x] **Button** variants: `primary` (ink, the main action), `key` (signal yellow, the one action to find), `outline`, `danger`, `link`, `dangerLink`; text Hind Siliguri 600 16; 56 px; corners 6 px. `dark` removed (its two uses now `key` on H12 and `outline` on the C1 card)
- [x] **Card:** white, 6 px corners, light shadow
- [x] **Chip:** white, 6 px corners, selected = grey border and 600 text (no ink fill)
- [x] **RadioRow:** white, selected = grey border and a filled grey ring on the left
- [x] **Field:** 56 px, 6 px corners, muted 14 px label, grey border while typing, alert border and tint on error
- [x] **Note:** plain (white, grey border), warn (yellow tint), alert (red tint), each with a thin border
- [x] **EmptyView**, footer and divider on the new tones
- [x] New **CodeBoxes**: digit boxes over one hidden input; the next box gets the grey border; error turns them alert
- [x] New **Stepper**: − value + with 48 px white squares
- [x] **BackButton** keeps icon plus text (project rule), now with a chevron

### Wired in
- [x] `src/ui/tabs.tsx`: one `tabScreenOptions` and `tabIcon` for both roles (white bar, active tab on a soft ink tile with 6 px corners, `animation: 'none'`); used by `(household)/(tabs)/_layout.tsx` and `(collector)/(work)/_layout.tsx`
- [x] H9 OTP uses `CodeBoxes` (6); C3 arrive uses `CodeBoxes` (4) instead of one wide input
- [x] C4/C10 weigh uses `Stepper`
- [x] Collector `CheckRow`: 4 px box, grey fill with a white tick when checked
- [x] `LanguageSwitch`: two white segments, selected = grey border
- [x] Badges, tags and toggles that used `radius.pill` now use 4 or 6 px

## Verification

| Check | Result |
| --- | --- |
| `pnpm turbo run lint typecheck test build` | 17 of 17 tasks pass |
| Mobile tests | 106 pass (101 before, plus 5 new in `src/ui/components.test.tsx`: button colours and no press style, chip/radio selected border, field focus and error border, code boxes, stepper) |
| Existing screen tests | OTP, arrive (`code-input`) and weigh (`inc-*`, `dec-*`) keep their test ids and pass unchanged |
| Real phone | Not done yet; to do at the start of V1-M3 |

## Decisions

- `primary` is now ink and `key` is yellow, following the designs. So the 32 buttons that used the default turned from yellow to ink; screens that need the yellow key action (Home sell, Request accept) switch to `key` in V1-M3 and V1-M4.
- No press feedback at all, as asked ("no animation"). If testers on real phones cannot tell a tap landed, the fallback is a plain border change, never a motion.
- Prettier is not part of the repo, so only the new and rewritten files were formatted; screen files keep their existing style with small edits.

## Open items (for V1-M3 and V1-M4)

- Screens still have their own hard-coded corners (12, 14, 16, 36 px), navy collector headers, and yellow-on-ink stat tiles; each is restyled with its screen.
- H5 "finding a collector" still has its pulsing radar (`Animated`); V1-M3 replaces it with still rings.
- Bottom sheets and the scale-photo viewer still slide or fade in (`Modal animationType`); set to `none` with their screens.
- Stack screen transitions (push and back) are unchanged; ask Rafsun whether they should go too.
