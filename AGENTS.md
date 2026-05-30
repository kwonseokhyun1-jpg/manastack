# AGENTS.md

## Cursor Cloud specific instructions

### Product

Single-app repo: **Manastack** (React/Vite SPA + Express API). Card JSON is served from `public/`; guest progress uses `localStorage`; auth/cloud save/trades use `/api` (SQLite in dev, Postgres when `POSTGRES_URL` / `DATABASE_URL` is set).

### Dependencies

- **Node.js** (v22+ observed) and **npm** (`package-lock.json`).
- Run `npm install` at repo root (handled by the VM update script).

### Card data

- `public/data/` already includes `commanders.json` and `minigame-pool.json` in this repo, so local dev works without the sibling `../website/mtg` project.
- `npm run predev` / `ensure-data` may warn if `../website/mtg` is missing; that warning is safe to ignore when required JSON is present under `public/data/`.
- To refresh from the sibling project: run `npm run build:data` in `../website/mtg`, then `npm run ensure-data` here.

### Running locally

| Service | Command | URL |
|---------|---------|-----|
| Full stack | `npm run dev` | Vite `http://localhost:5173/`, API `http://localhost:3001` |
| API only | `npm run dev:server` | `http://localhost:3001` |
| Frontend only | `npx vite` | `http://localhost:5173/` (no `/api` unless API is running) |
| Stuck ports | `npm run dev:fresh` | Kills `5173`/`3001` then starts `dev` |

Vite proxies `/api` → `http://localhost:3001`. Prefer **`http://localhost:5173`** over `127.0.0.1:5173` in this environment: Vite may listen on IPv6 (`::1`) only.

For headless/browser access from another host, start Vite with `--host` (not in the default `dev` script).

### Verify health

```bash
curl -s http://localhost:3001/api/health    # {"ok":true}
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/data/minigame-pool.json
```

### Lint / test / build

- **Lint:** `npm run lint` (see README; some ESLint errors may already exist on `main`).
- **Tests:** No automated test runner in-repo.
- **Build:** `npm run build` (runs trivia generation, `tsc -b`, `vite build`; `prebuild` may create `public/data/cards.json` from the minigame pool).

### Auth API note

Signup/login expect a valid **email** address in the request body, not a bare username.

### Scryfall

Art Guess and card-detail flows call Scryfall over HTTPS; most other minigames use bundled JSON only.
