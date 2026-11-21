# @bw/landing: public landing page

One scrolling page for people who have not installed the app yet. Bangla first, English toggle (remembered in
`localStorage` under `bw.landing.lang`). It reads only two public endpoints, `GET /categories` and
`GET /rates/today`, to fill the live rate board; everything else is static copy.

```bash
pnpm dev:landing           # http://localhost:5174, proxies /api to the API on :3000 (API_TARGET to change)
pnpm --filter @bw/landing test
docker build -f docker/landing/Dockerfile .   # nginx image on :8080; also in docker-compose.prod.yml (LANDING_PORT, default 8081)
```

`VITE_API_URL` points the page at another API (default: same origin `/api/v1`).

## Layout

| Path | What it holds |
| --- | --- |
| `src/App.tsx` | Section order; loads the rate board once and hands it to the hero and the rates section |
| `src/sections/` | One file per page section: Header, Hero, Promises, HowItWorks, Rates, Items, Safety, Collectors, Faq, Footer |
| `src/components/` | Shared pieces: BrandMark (logo L3), Icon (line icons), RateList (the H2 dotted-leader rate rows), SectionHeading, LangProvider |
| `src/hooks/useRateBoard.ts` | Loading, ready, empty (nothing published yet) and error states, with retry |
| `src/api/rates.ts` | The two fetches |
| `src/lib/` | Pure logic (`rates.ts`: join categories with rates, format, trend) and the language context |
| `src/styles/` | `tokens.css` (brand tokens from `@bw/shared` theme), `base.css`, `components.css`, `layout.css`, `sections.css` |
| `public/` | Favicon and the L1/L5 logo art from `docs/design/logos/` |

Strings live in `packages/shared/src/landing-i18n.ts` (`tl(key, lang, vars)`); add every new string in both languages.

## Open (M7)

- Google Play link once the listing exists (the page says "coming soon").
- Support phone, terms and privacy policy links once the content is written.
