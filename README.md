# osu! Beatmap Tag Analyzer

A web app that analyzes your osu! standard play history and recommends beatmaps based on your dominant playstyle — powered by a custom LSTM model trained on community-tagged beatmaps.

![Tech Stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20React%20%2B%20PostgreSQL-blueviolet)
![Model](https://img.shields.io/badge/model-LSTM%20v13-ff6b9d)
![License](https://img.shields.io/github/license/aryaawcksn/osu-tag-predict)

---

## Features

- **Playstyle prediction** — Paste a beatmap link or upload a `.osu` file to predict its playstyle tags (jumps, streams, tech, etc.) using a trained LSTM model
- **Play history analysis** — Log in with osu! OAuth and analyze your top/recent plays to find your dominant playstyle
- **Map recommendations** — Get beatmap recommendations matching your playstyle with difficulty and status filters
- **Tag search** — Browse the full beatmap database by playstyle tags with difficulty, status, and year filters (2007–now)
- **Hide beatmaps** — Right-click any recommendation to hide a beatmap or entire beatmapset; manage hidden maps in your profile
- **Daily crawler** — Automatically fetches and predicts newly ranked osu!std beatmaps every 24 hours in the background
- **Queue system** — 5-slot prediction queue with real-time status indicator
- **Live stats** — Total users and beatmaps processed shown in the UI

## Future Development
 - **New Tag Predict** - More new tag prediction
 - **New Model** - Planned to using transformers
 - **New Website Features** - Able to store your favorite tags, Recommend similar beatmaps, etc.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Backend | FastAPI, Python 3.11 |
| ML Model | TensorFlow / Keras (LSTM), scikit-learn |
| Database | PostgreSQL 16 |
| Auth | osu! OAuth 2.0 (PKCE) |
| Deploy | Docker Compose |


### Prerequisites

- An osu! OAuth application — register at https://osu.ppy.sh/home/account/edit under "OAuth"

### Clone repo

```bash
git clone https://github.com/aryaawcksn/osu-predict.git
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/stats` | Total users and beatmaps (public) |
| `POST` | `/predict/link` | Submit beatmap link to queue |
| `POST` | `/predict/upload` | Submit `.osu` file to queue |
| `GET` | `/queue/state` | Current queue status |
| `GET` | `/queue/job/{id}` | Job result by ID |
| `GET` | `/analysis/playstyle` | Analyze play history (auth required) |
| `GET` | `/recommend` | Get recommendations by playstyle (auth required) |
| `GET` | `/beatmaps/by-tags` | Search beatmaps by tags (auth required) |
| `GET` | `/hidden` | List hidden beatmaps (auth required) |
| `POST` | `/hidden/{beatmap_id}` | Hide a beatmap (auth required) |
| `POST` | `/hidden/set/{beatmapset_id}` | Hide entire beatmapset (auth required) |
| `POST` | `/hidden/multi-unhide` | Unhide multiple at once (auth required) |
| `POST` | `/crawler/run` | Manually trigger crawler (admin key) |
| `GET` | `/crawler/status` | Crawler status (admin key) |

## Playstyle Tags

The model predicts 57 playstyle tags organized into categories:

| Category | Examples |
|---|---|
| `skillset/` | jumps, streams, tech, alt, precision, reading |
| `jumps/` | linear, triangles, wide, cross-screen, squares |
| `streams/` | bursts, flow aim, spaced streams, stamina |
| `tech/` | slider tech, aim control, finger control |
| `sliders/` | high sv, low sv, complex sv, complex slidershapes |
| `reading/` | overlaps, visual density, perfect stacks |
| `style/` | clean, geometric, freeform, grid snap, distance snap |
| `expression/` | simple, chaotic, high contrast, iNiS-style |
| `meta/` | variable timing, swing, accelerating bpm |
| `gimmick/` | ninja spinners, circle only |

---

## Daily Crawler

The backend automatically crawls newly ranked osu!std beatmaps once every 24 hours:

- Fetches the latest ranked/loved beatmapsets from the osu! API
- Skips beatmaps already in the database
- Predicts new ones using the LSTM model with a separate concurrency limit (default: 2) so it never blocks user predictions
- Configurable via environment variables:

```env
CRAWLER_CONCURRENCY=2          # parallel predictions during crawl
CRAWLER_PAGES_PER_RUN=5        # pages fetched per run (20 beatmaps/page)
CRAWLER_INTERVAL_SECONDS=86400 # interval between runs (default 24h)
```

---

## License

[MIT](LICENSE)
