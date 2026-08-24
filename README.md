# osu! Playstyle Analyzer

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

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Backend | FastAPI, Python 3.11 |
| ML Model | TensorFlow / Keras (LSTM), scikit-learn |
| Database | PostgreSQL 16 |
| Auth | osu! OAuth 2.0 (PKCE) |
| Deploy | Docker Compose |

## Project Structure

```
.
├── backend/
│   ├── main.py               # FastAPI app, all routes
│   ├── predictor.py          # LSTM model inference + .osu file parsing
│   ├── recommendation.py     # DB upsert, lazy metadata fetch, recommendations
│   ├── analysis.py           # Play history fetch + playstyle calculation
│   ├── crawler.py            # Daily background beatmap crawler
│   ├── auth.py               # osu! OAuth routes
│   ├── models.py             # SQLAlchemy ORM models
│   ├── database.py           # Async DB engine + session factory
│   ├── queue_manager.py      # 5-slot async prediction queue
│   ├── dependencies.py       # FastAPI auth dependency
│   ├── migrations/           # SQL migration files
│   ├── scripts/
│   │   └── import_predictions.py   # Bulk import from output_predictions.json
│   ├── model_lstm_osu_dataset_vXIII.keras
│   └── pickle_mlb_VXIII.pkl
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts            # All fetch calls to backend
│   │   ├── types.ts
│   │   └── components/
│   │       ├── BeatmapCard.tsx       # Card with right-click hide menu
│   │       ├── BeatmapTagSearch.tsx  # Tag + year + difficulty search
│   │       ├── RecommendationList.tsx
│   │       ├── AnalysisPanel.tsx
│   │       ├── ProfilePage.tsx       # Hidden beatmaps manager
│   │       ├── QueueBar.tsx          # Queue + stats indicator
│   │       └── NavBar.tsx
│   └── index.html
├── docker-compose.yml
└── .env.example
```

## Getting Started

### Prerequisites

- Docker + Docker Compose
- An osu! OAuth application — register at https://osu.ppy.sh/home/account/edit under "OAuth"

### 1. Clone and configure

```bash
git clone https://github.com/aryaawcksn/osu-predict.git
cd osu-predict
cp .env.example .env
```

Edit `.env`:

```env
DB_PASSWORD=your_strong_password
OSU_CLIENT_ID=your_osu_client_id
OSU_CLIENT_SECRET=your_osu_client_secret
OSU_REDIRECT_URI=http://localhost:5001/auth/callback
SESSION_SECRET=random_string_at_least_32_chars
ADMIN_KEY=your_admin_key
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
MODEL_VERSION=XIII
```

### 2. Start services

```bash
docker compose up -d --build
```

This starts:
- `db` — PostgreSQL on port 5432
- `backend` — FastAPI on port 5001

### 3. Run database migrations

```bash
# Initial schema (runs automatically on first DB start via init.sql)
# Additional migrations:
docker compose cp backend/migrations/add_beatmap_metadata.sql db:/tmp/
docker compose exec db psql -U osu -d osu_playstyle -f /tmp/add_beatmap_metadata.sql

docker compose cp backend/migrations/add_beatmapset.sql db:/tmp/
docker compose exec db psql -U osu -d osu_playstyle -f /tmp/add_beatmapset.sql

docker compose cp backend/migrations/add_ranked_date.sql db:/tmp/
docker compose exec db psql -U osu -d osu_playstyle -f /tmp/add_ranked_date.sql
```

### 4. Import predictions (optional)

To seed the database from `output_predictions.json`:

```bash
docker compose cp output_predictions.json backend:/tmp/output_predictions.json
docker compose exec backend python scripts/import_predictions.py /tmp/output_predictions.json
```

### 5. Start the frontend

```bash
cd frontend
cp .env.example .env   # set VITE_API_URL=http://localhost:5001
npm install
npm run dev
```

Open http://localhost:5173

---

## API Endpoints

Full interactive docs available at `http://localhost:5001/docs`

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

### Admin endpoints

Require `X-Admin-Key` header matching the `ADMIN_KEY` env var:

```bash
curl -X POST http://localhost:5001/crawler/run \
  -H "X-Admin-Key: your_admin_key"
```

---

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

## Environment Variables

| Variable | Description |
|---|---|
| `DB_PASSWORD` | PostgreSQL password |
| `OSU_CLIENT_ID` | osu! OAuth app client ID |
| `OSU_CLIENT_SECRET` | osu! OAuth app client secret |
| `OSU_REDIRECT_URI` | OAuth callback URL |
| `SESSION_SECRET` | Secret for session token signing |
| `ADMIN_KEY` | Key for admin-only endpoints |
| `FRONTEND_URL` | Frontend origin (for OAuth redirect) |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) |
| `MODEL_VERSION` | Model version label (default: `XIII`) |
| `CRAWLER_CONCURRENCY` | Crawler parallel predictions (default: `2`) |
| `CRAWLER_PAGES_PER_RUN` | Pages fetched per crawler run (default: `5`) |
| `CRAWLER_INTERVAL_SECONDS` | Crawler run interval in seconds (default: `86400`) |

---

## License

[MIT](LICENSE)
