# AnimeQ — Premium Anime Streaming Platform

A fully **client-side** anime streaming app built with **Vite + React + TypeScript + Tailwind CSS**, using **Tabler Icons** and **react-router**. Deployed to **Cloudflare Pages** with a same-origin edge proxy (Pages Function) — no long-running server.

> 🔒 **This site is intentionally unindexable** (`robots.txt` Disallow, `X-Robots-Tag: noindex`, `<meta robots noindex>`, no sitemap).

## Features

- **Ad-free, premium UI** — clean, responsive interface for mobile & desktop.
- **HD resolution options** — adaptive HLS (hls.js) + DASH (dash.js), 4K/1080p/720p/480p/360p with in-player quality switching.
- **Low-latency global streaming** — `hls.js` low-latency mode + `dash.js` ABR.
- **Multi-provider playback** — Animex (HLS, priority), AnimeOnsen (DASH), KickAssAnime (HLS). Animex matches by **MAL id** (exact) and aggregates all its servers (mimi, miku, neko, kuro…). Pick provider + server in the UI.
- **Offline viewing** — episodes downloaded to **IndexedDB** (blob storage), managed in My Library.
- **Personalized recommendations** — Jikan recommendations based on the title + watch history.
- **Continue watching** — watch history with progress tracking.
- **Dark mode** — light / dark / system, persisted.
- **Cross-device sync** — export/import library + history via a Sync ID (JSON backup).
- **Robust search & filtering** — by title, genre (include/exclude), season, year, type, status, min-score, sort, with pagination and reliable fallbacks.
- **Airing schedule** — by weekday, powered by MyAnimeList (Jikan `/schedules`).
- **Trailers** — YouTube iframe (privacy-enhanced nocookie embed).
- **Comprehensive data** — Jikan API (MyAnimeList).

## Architecture

### Same-origin relay (the key piece)

Provider APIs and streams are cross-origin, need custom headers (Referer/Origin/Authorization), POST bodies, and (for AnimeOnsen) a dynamic token from a `set-cookie`. A browser can't do any of that directly. So all provider + media traffic flows through a **same-origin relay** that runs:

- **In dev:** a Vite dev-server plugin (`vite/proxy-plugin.ts`) — so `bun run dev` works fully (incl. the player).
- **In production:** a Cloudflare Pages Function (`functions/api/proxy.ts`) — an edge Worker (not a server).

The relay:
- forwards method/headers/body,
- injects each provider's required `Origin`/`Referer`/`Authorization` (Animex whitelists only its own Origin),
- **rewrites HLS manifests** so sub-playlists/segments route back through the proxy with the right headers,
- exposes `GET /api/proxy?url=...&headers=...` (media + JSON) and `POST /api/proxy {url,method,headers,body}` (JSON).

A second Function (`functions/api/animeonsen.ts`, shared logic in `shared/animeonsen-relay.ts`) does the AnimeOnsen token refresh server-side (reads `ao.session` cookie → `decodeURIComponent → atob → Caesar +1`) since that needs `set-cookie` access.

### ⚠️ Important: datacenter-IP blocking (production playback)

Some provider content endpoints (notably Animex's **`pp.animex.one`**) **block Cloudflare Workers egress IPs** with HTTP 403. A Pages Function runs on Cloudflare, so it can reach Animex's search (`graphql.animex.one`) but **not** `pp.animex.one` (servers/sources) → Animex playback fails on the deployed site. The same code works fine from a **residential IP**.

Playback works in these setups:
1. **Local dev** — `bun run dev` uses your residential IP via the Vite proxy plugin. ✅ (best for personal use)
2. **Self-hosted relay on a non-blocked IP** — deploy the same relay logic (`functions/api/proxy.ts`) to a VPS / non-Cloudflare host and set its URL in **Settings → CORS proxy URL** (or `localStorage['animeq:proxyBase']`). The override is treated as a full relay accepting the `POST {url,method,headers,body}` and `GET ?url=&headers=` contract.

When a provider is blocked, the watch page shows a clear message and you can switch providers or run locally.

### Providers (`src/lib/api/resolvers/`)

| Provider | Format | Match | Notes |
| --- | --- | --- | --- |
| **Animex** (priority) | HLS `.m3u8` | exact **MAL id** then title | GraphQL search → servers → sources; aggregates all servers (mimi, miku…); sub=hard-sub |
| **AnimeOnsen** | DASH `.mpd` | title (own id system) | token refresh via relay |
| **KickAssAnime** | HLS `.m3u8` | title | extracts stream from embed page |

`resolveProvider(provider, req)` resolves a single provider on demand (default Animex); no parallel auto-search.

### Data

| Source | Purpose |
| --- | --- |
| [Jikan API](https://jikan.moe) (MyAnimeList) | Anime DB, search, seasons, schedule, recommendations |
| YouTube (iframe) | Trailers |
| Animex / AnimeOnsen / KickAssAnime | Video sources |

The Jikan client is **serial-rate-limited** (~2.5 req/s), **cached** (5 min), and retries 5xx/429 (incl. error envelopes) with fast failover. Browse falls back from the flaky `/anime` search to reliable `topAnime` when no filters are set.

## Tech Stack

- **Vite 5** + **React 18** + **TypeScript** (strict)
- **Tailwind CSS 3** (dark mode via `class`)
- **react-router 7** (data router, `createBrowserRouter`); lazy-loaded routes + skeletons
- **Zustand** (persisted settings/history/library)
- **idb** (IndexedDB offline blobs)
- **hls.js** + **dashjs** (adaptive playback)
- **@tabler/icons-react**
- **Cloudflare Pages Functions** (edge proxy) — `@cloudflare/workers-types`

## Getting Started

Requirements: **Bun** (or Node 18+).

```bash
bun install
bun run dev        # http://localhost:5173  (full app incl. player via the proxy plugin)
```

### Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Dev server (full app incl. player) |
| `bun run build` | Production build → `dist/` |
| `bun run preview` | Preview the production build |
| `bun run serve` | Build + serve `dist/` with Cloudflare Pages Functions (prod parity) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run deploy` | Build + deploy to Cloudflare Pages |

## Deploy to Cloudflare Pages

Static SPA + edge Functions. No server.

**Option A — Wrangler CLI:**
```bash
bun run deploy      # = vite build && wrangler pages deploy dist
```
First run prompts for a project name (or set it with `wrangler pages deploy dist --project-name=animeq`). Connect/confirm your Cloudflare account (`wrangler login`).

**Option B — Git integration:**
1. Push to GitHub.
2. Cloudflare Pages → Create project → connect repo.
3. Build settings: framework preset **Vite**, build command `bun run build` (or `npm run build`), output `dist`.
4. Deploy. Functions in `functions/` deploy automatically.

Routing/SEO files ship in `public/`:
- `_redirects` (`/* /index.html 200`) — SPA fallback
- `_headers` (`X-Robots-Tag: noindex, nofollow`) — unindexable
- `robots.txt` (`Disallow: /`)

## Project Structure

```
src/
├── main.tsx                  # Router + lazy routes
├── index.css                 # Tailwind + components
├── types/index.ts            # Jikan / schedule / app types
├── lib/
│   ├── api/
│   │   ├── jikan.ts          # Jikan client (serial-limited, cached, retried)
│   │   ├── animeschedule.ts  # schedule (Jikan /schedules)
│   │   ├── proxy.ts          # same-origin relay client (/api/proxy)
│   │   ├── sources.ts        # provider labels + groupByProvider
│   │   ├── matching.ts       # title similarity + TTL cache
│   │   └── resolvers/        # animex / animeonsen / kickassanime
│   ├── store.ts              # Zustand: settings, history, library
│   ├── db.ts                 # IndexedDB offline store
│   ├── filterQuery.ts        # filter → Jikan params + fallbacks
│   ├── constants.ts          # genres, seasons, qualities
│   └── utils.ts              # formatters, rate limiter
├── components/{layout,ui,anime,player,filters}
└── pages/                    # Home, Browse, Search, AnimeDetail, Watch, Schedule, Library, Settings, NotFound

functions/api/                # Cloudflare Pages Functions (edge relay)
├── proxy.ts                  # /api/proxy (CORS proxy + HLS rewriting)
└── animeonsen.ts             # /api/animeonsen (token refresh)
shared/animeonsen-relay.ts    # shared token-refresh logic
vite/proxy-plugin.ts          # same relay for `bun run dev`
public/                       # _redirects, _headers, robots.txt, favicon.svg
```

## Disclaimer

AnimeQ is for **educational purposes**. It aggregates publicly available metadata and proxies provider streams; it does not host content. Respect each provider's terms of service and your local copyright laws.
