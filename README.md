# Coral Island Wiki TH

วิกิเกม Coral Island ภาษาไทย — ข้อมูลจากไฟล์ภาษาไทยในตัวเกม

A fan-made, Thai-language wiki for the farming game *Coral Island*, built as a static Astro site.
Every in-game name comes from the game's own Thai localization file instead of a hand translation,
so pages use the exact words Thai players see on screen.

> **Status:** archived. The fish section (index + detail pages) is complete; the site is no longer deployed.

## How it works

```
data/raw/  (FModel exports, not committed)        scripts/                     src/pages/
  DT_Fish.json           ─┐                                                   fish/index.astro
  DT_InventoryItems.json ─┼─▶ transform-fish.ts ─▶ data/processed/fish.json ─▶ fish/[slug].astro
  th.locres              ─┘     (+ locres.ts)
```

- **`scripts/locres.ts`**: a small binary reader for Unreal Engine `.locres` files (v3, CityHash64/UTF-16) that pulls Thai strings out of the game data with no dependencies.
- **`scripts/transform-fish.ts`**: validates the raw data tables with Zod, groups the spawn rows by item (one fish can spawn under several conditions) and joins the Thai names. Output: 69 fish, 63 of them with an official Thai name. Missing translations are left as `null` and reported, never guessed.
- **Pages**: a filterable fish index (season, time of day) plus one static detail page per fish. Each page has a unique Thai title and meta description, an ASCII slug, and both the Thai and English names.

## Stack

Astro 7 · TypeScript (strict) · Tailwind CSS 4 · Zod · `@astrojs/sitemap` · self-hosted Noto Sans Thai · Cloudflare Workers static assets

Fully static: no SSR, no database, no API routes.

## Run it

Requires Node 22.12+.

```bash
npm install
npm run dev              # dev server
npm run build            # static build to dist/
npm run transform:fish   # rebuild data/processed/fish.json (needs data/raw/)
npm test                 # transform self-check (needs data/raw/)
```

`data/raw/` holds the game exports and is gitignored. The processed `fish.json` is committed, so `dev` and `build` work without it.

## Disclaimer

Fan-made project, not affiliated with Stairway Games. Game data © Stairway Games.
