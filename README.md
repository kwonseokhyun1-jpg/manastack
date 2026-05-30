# Manastack

MTG minigames where you earn **mana** from wins, spend it on **Commander booster packs**, and build your **collection**.

## Setup

Card data is linked from the sibling `website/mtg` project:

```bash
npm install
npm run ensure-data   # links public/data from ../website/mtg/public/data
npm run dev
```

If card data is missing, run `npm run build:data` in `../website/mtg` first.

## Game loop

1. **Minigames** — Art Guess & Unscramble (copied from Commander Helper). Win = +1 mana.
2. **Shop** — Open a booster pack for 10 mana. Get 10 random Commander-legal cards (1 foil guaranteed, no duplicate non-foils).
3. **Inventory** — View your collection and organize cards into showcase folders.

Progress is saved in localStorage (and in the cloud when you sign in).

## Deploy to Cloudflare

The app deploys as a **Cloudflare Worker** with static assets (`dist/`) and the Express API on `/api/*` (same as local dev).

### Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (included as `npm run deploy:cloudflare`)
- **Postgres** for auth, cloud saves, and trades (e.g. [Neon](https://neon.tech/) — the app already uses `@neondatabase/serverless`)

### One-time setup

```bash
npm install
npx wrangler login
```

Set secrets (production values — do not commit these):

```bash
npx wrangler secret put DATABASE_URL    # Neon Postgres connection string
npx wrangler secret put JWT_SECRET      # Long random string for session tokens
```

Optional local preview secrets: copy `.dev.vars.example` to `.dev.vars` and fill in the same variables for `wrangler dev`.

### Deploy

```bash
npm run deploy:cloudflare
```

Wrangler prints your live URL (e.g. `https://manastack.<account>.workers.dev`).

### Preview locally (production-like)

```bash
npm run preview:cloudflare
```

### Custom domain

In the Cloudflare dashboard: **Workers & Pages** → your worker → **Settings** → **Domains** → add a custom domain.

### Notes

- **SQLite does not run on Cloudflare Workers** — use `DATABASE_URL` (Postgres). Local dev still uses SQLite when no Postgres URL is set.
- To point the frontend at a different API host, set `VITE_API_BASE` at build time (usually leave unset so `/api` stays same-origin).
