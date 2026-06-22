# AnimeQ — Premium Anime Streaming Desktop App

A cross-platform **desktop** anime streaming app built with **Vite + React + TypeScript + Tailwind**, wrapped as a native app via **Pytauri** (Python + Tauri) and bundled with **PyInstaller**.

The proxy runs **locally on your own machine** — so playback uses a residential IP (no datacenter-IP blocking) and there are no CORS issues. No Cloudflare, no server to deploy.

> 🔒 Not a web app — there is no public URL. `robots.txt`/noindex ship in `public/` but are irrelevant to a desktop binary.

## Features

- **Ad-free, premium UI** — clean, responsive interface.
- **HD resolution options** — adaptive HLS (hls.js) + DASH (dash.js), 4K/1080p/720p/480p/360p with in-player quality switching.
- **Low-latency streaming** — `hls.js` low-latency mode + `dash.js` ABR.
- **Multi-provider playback** — Animex (HLS, priority), AnimeOnsen (DASH), KickAssAnime (HLS). Animex matches by **MAL id** (exact) and aggregates all its servers (mimi, miku, neko, kuro…). Pick provider + server in the UI.
- **Offline viewing** — episodes downloaded to **IndexedDB** (blob storage), managed in My Library.
- **Personalized recommendations** — Jikan recommendations based on the title + watch history.
- **Continue watching** — watch history with progress tracking.
- **Dark mode** — light / dark / system, persisted.
- **Cross-device sync** — export/import library + history via a Sync ID (JSON backup).
- **Robust search & filtering** — by title, genre (include/exclude), season, year, type, status, min-score, sort, with pagination and fallbacks.
- **Airing schedule** — by weekday, powered by MyAnimeList (Jikan `/schedules`).
- **Trailers** — YouTube iframe (privacy-enhanced nocookie embed).

## Architecture

### Local Python relay (the key piece)

Provider APIs and streams are cross-origin and need custom headers (Referer/Origin/Authorization), POST bodies, and (for AnimeOnsen) a dynamic token from a `set-cookie`. A webview can't do any of that directly. So all provider + media traffic flows through a **local Python server** (`python/src/animeq/server.py`, FastAPI + uvicorn) that the app starts on `127.0.0.1:8788`:

- serves the built frontend at `/` (SPA),
- exposes `GET /api/proxy?url=...&headers=...` (media + JSON) and `POST /api/proxy {url,method,headers,body}` (JSON),
- injects each provider's `Origin`/`Referer`/`Authorization`,
- **rewrites HLS manifests** so sub-playlists/segments route back through the proxy with the right headers,
- `GET /api/animeonsen?id=&ep=` refreshes the AnimeOnsen video bearer token server-side (reads `ao.session` cookie → `decodeURIComponent → atob → Caesar +1`).

The webview and the proxy share an origin (`http://127.0.0.1:8788`), so the SPA's relative `/api/proxy` calls work same-origin. The app waits for the server to accept TCP connections **before** opening the window (no blank/black startup).

| Environment | Frontend | Proxy |
| --- | --- | --- |
| **Dev** | Vite dev server `http://127.0.0.1:1420` (HMR) | Vite plugin `vite/proxy-plugin.ts` (same `/api/proxy` contract) |
| **Prod (built app)** | Python server `http://127.0.0.1:8788` | `python/src/animeq/server.py` |

### Providers (`src/lib/api/resolvers/`)

| Provider | Format | Match | Notes |
| --- | --- | --- | --- |
| **Animex** (priority) | HLS `.m3u8` | exact **MAL id** then title | GraphQL search → servers → sources; aggregates all servers (mimi, miku…); sub=hard-sub |
| **AnimeOnsen** | DASH `.mpd` | title (own id system) | video token refreshed via the Python relay |
| **KickAssAnime** | HLS `.m3u8` | title | extracts stream from embed page |

`resolveProvider(provider, req)` resolves a single provider on demand (default Animex); no parallel auto-search.

### Data

| Source | Purpose |
| --- | --- |
| [Jikan API](https://jikan.moe) (MyAnimeList) | Anime DB, search, seasons, schedule, recommendations |
| YouTube (iframe) | Trailers |
| Animex / AnimeOnsen / KickAssAnime | Video sources |

The Jikan client is **serial-rate-limited**, **cached** (5 min), and retries 5xx/429 (incl. error envelopes) with fast failover.

## Tech Stack

- **Frontend:** Vite 5 + React 18 + TypeScript (strict) + Tailwind CSS 3 + react-router 7 + Zustand + idb + hls.js + dashjs + @tabler/icons-react
- **Desktop:** [Pytauri](https://github.com/WSH032/pytauri) 0.6 (`pytauri-wheel`) + Tauri webview
- **Bundling:** PyInstaller 6
- **Python server:** FastAPI + uvicorn + httpx

## Requirements

- **Bun** (or Node 18+) — frontend deps + build
- **Python 3.10–3.13** + `pip`
- **Rust/Cargo** — required to build the Tauri native parts (first Pytauri build compiles them)
- macOS / Windows / Linux

## Getting Started

### 1. Install dependencies

```bash
make setup        # bun install + creates .venv + installs python deps
```

Or manually:
```bash
bun install
python3 -m venv .venv && .venv/bin/pip install -e python
```

### 2. AnimeOnsen search token (optional)

AnimeOnsen's catalog search needs a bearer token. Copy `.env.example` → `.env` and set `VITE_ANIMEONSEN_SEARCH_TOKEN`. To fetch/verify a token (and the dynamic video token), use the helper:

```bash
.venv/bin/python python/src/script/get_token.py "Attack on Titan"
```

(AnimeOnsen playback still works without it via the dynamic token refresh in the relay; the search token only enables the catalog lookup.)

## Development

```bash
make dev         # Vite (HMR) + Pytauri window, hot reload via jurigged
```

This starts the Vite dev server on `http://127.0.0.1:1420` (bound to IPv4, matching the webview URL) and launches the native window. The Vite plugin serves `/api/proxy` same-origin during dev.

## Build the desktop app

```bash
make build       # vite build → python/src/animeq/frontend, then PyInstaller
```

`make build` auto-selects the host platform's spec:
- macOS → `animeq-macos.spec` → `dist/AnimeQ.app`
- Windows → `animeq-windows.spec` → `dist/AnimeQ.exe`
- Linux → `animeq-linux.spec`

Or call directly:
```bash
bun desktop:build:mac         # or :windows
python -m PyInstaller animeq-windows.spec --noconfirm
```

Open the result: `make run` (macOS opens `dist/AnimeQ.app`).

### Makefile targets

| Target | Description |
| --- | --- |
| `make setup` | Install JS + Python deps (creates `.venv`) |
| `make dev` | Run the app in dev mode (Vite HMR + Pytauri) |
| `make build` | Build the frontend + bundle the desktop app via PyInstaller |
| `make run` | Open the built app |
| `make clean` | Remove build artifacts |
| `make help` | List all targets |

### npm scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Vite dev server only |
| `bun run build` | Build frontend → `python/src/animeq/frontend` |
| `bun run typecheck` | `tsc --noEmit` |
| `bun desktop:dev` | Dev launcher (`app_dev.py`) |
| `bun desktop:build:mac` | Build macOS `.app` |
| `bun desktop:build:windows` | Build Windows `.exe` |

## Project Structure

```
src/                          # Frontend (React + TS)
├── main.tsx                  # Router + lazy routes
├── lib/
│   ├── api/
│   │   ├── jikan.ts          # Jikan client (serial-limited, cached, retried)
│   │   ├── animeschedule.ts  # schedule (Jikan /schedules)
│   │   ├── proxy.ts          # local relay client (/api/proxy)
│   │   ├── matching.ts       # title similarity + TTL cache
│   │   └── resolvers/        # animex / animeonsen / kickassanime
│   ├── store.ts / db.ts      # Zustand stores + IndexedDB
│   ├── filterQuery.ts        # filter → Jikan params + fallbacks
│   └── utils.ts / constants.ts
├── components/{layout,ui,anime,player,filters}
└── pages/                    # Home, Browse, Search, AnimeDetail, Watch, Schedule, Library, Settings, NotFound

python/                       # Pytauri desktop app
├── pyproject.toml            # pytauri, pyinstaller, fastapi, uvicorn, httpx
└── src/animeq/
    ├── __init__.py           # Pytauri entry: start relay server + run Tauri window
    ├── __main__.py           # `python -m animeq` entry
    ├── main.py               # PyInstaller entry
    ├── server.py             # FastAPI relay: frontend + /api/proxy + /api/animeonsen
    ├── tauri.conf.json       # Tauri config
    ├── capabilities/         # Tauri permissions
    ├── icons/                # app icons (png/ico/icns)
    └── frontend/             # built frontend (gitignored; populated by `vite build`)

python/src/script/get_token.py  # helper to fetch/verify AnimeOnsen tokens
vite/proxy-plugin.ts            # same /api/proxy contract for dev (Vite middleware)
app_dev.py                      # dev launcher (Vite + jurigged + Pytauri)
animeq-macos.spec               # PyInstaller spec (macOS)
animeq-windows.spec             # PyInstaller spec (Windows)
Makefile                        # setup / dev / build / run / clean
public/                         # favicon.svg, robots.txt
```

## Disclaimer

AnimeQ is for **educational purposes**. It aggregates publicly available metadata and proxies provider streams from your own machine; it does not host content. Respect each provider's terms of service and your local copyright laws.
