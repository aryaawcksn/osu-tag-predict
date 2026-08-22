# Design Document: osu! Playstyle Platform

## Overview

Platform ini memperluas aplikasi osu! Playstyle Predictor yang sudah ada dengan menambahkan tiga fitur utama: sistem antrian live, autentikasi osu! OAuth, dan sistem rekomendasi map berbasis playstyle. Backend berjalan di Ubuntu server dengan Cloudflare Tunnel, frontend di-deploy di Vercel, dan PostgreSQL sebagai database persisten.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Vercel (Frontend)                 │
│   React + Vite                                      │
│   - Queue display (polling setiap 2s)               │
│   - osu! OAuth redirect/callback                    │
│   - Analysis & recommendation UI                   │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS (Cloudflare Tunnel)
┌────────────────────▼────────────────────────────────┐
│              Ubuntu Server (Backend)                │
│   FastAPI                                           │
│   ├── /auth/*        OAuth 2.0 handler              │
│   ├── /queue/*       Queue state & management       │
│   ├── /predict/*     Prediction (existing + queue)  │
│   ├── /analysis/*    Play history analysis          │
│   ├── /recommend/*   Map recommendations            │
│   └── /admin/*       Manual DB management           │
│                                                     │
│   QueueManager (in-process, max 5 slots)            │
│   └── asyncio semaphore + DB persistence            │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│           PostgreSQL (same Ubuntu server)           │
│   - users                                           │
│   - sessions                                        │
│   - queue_items                                     │
│   - beatmaps                                        │
│   - beatmap_labels                                  │
└─────────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│               osu! API (external)                   │
│   - OAuth 2.0 token exchange                        │
│   - GET /me (user profile)                          │
│   - GET /users/{id}/scores/best                     │
│   - GET /users/{id}/scores/recent                   │
└─────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **Polling vs WebSocket untuk queue**: Dipilih polling (interval 2 detik) karena lebih simpel untuk setup dengan Cloudflare Tunnel, tidak memerlukan sticky sessions, dan latency 2-3 detik masih acceptable untuk queue display.
- **Session storage**: Server-side session disimpan di PostgreSQL (bukan Redis) untuk mengurangi dependency. Session ID disimpan di cookie httpOnly.
- **Queue persistence**: Queue state disimpan di DB sehingga jika backend restart, queue bisa direstorasi.
- **Rekomendasi Phase 1**: Database map diisi manual oleh operator + otomatis dari setiap prediksi yang masuk. Rekomendasi hanya dari internal DB, bukan dari osu! API secara langsung.

---

## Components and Interfaces

### Backend Components

#### 1. QueueManager
Mengelola antrian prediksi dengan asyncio semaphore (maks 5 slot).

```python
class QueueManager:
    async def enqueue(job_id: str, user_id: Optional[int]) -> QueuePosition
    async def process_next() -> None
    async def get_queue_state() -> QueueState
    async def mark_complete(job_id: str, result: dict) -> None
    async def mark_failed(job_id: str, error: str) -> None
    async def restore_from_db() -> None
```

#### 2. AuthHandler
Mengelola osu! OAuth 2.0 flow.

```python
# Routes
GET  /auth/login          → redirect ke osu! OAuth
GET  /auth/callback       → exchange code → token, simpan session
POST /auth/logout         → invalidate session
GET  /auth/me             → return current user info
```

#### 3. AnalysisService
Mengambil play history dan menghitung dominant playstyle.

```python
class AnalysisService:
    async def fetch_top_plays(user_id: int, token: str, limit: int = 20) -> List[BeatmapScore]
    async def fetch_recent_plays(user_id: int, token: str, limit: int = 20) -> List[BeatmapScore]
    def calculate_dominant_playstyle(predictions: List[PredictResult]) -> DominantPlaystyle
```

#### 4. RecommendationService
Query DB untuk rekomendasi berdasarkan playstyle label.

```python
class RecommendationService:
    async def get_recommendations(playstyle: str, limit: int = 10) -> List[BeatmapRecord]
    async def upsert_beatmap(result: PredictResult) -> BeatmapRecord
```

### Frontend Components

```
App
├── NavBar          — username display, login/logout button
├── QueueBar        — live queue status display (polls /queue/state)
├── LinkInput       — existing, diperluas untuk queue-aware submission
├── ResultCard      — existing
├── AnalysisPanel   — pilih top/recent, progress indicator, dominant playstyle
└── RecommendationList — daftar map yang direkomendasikan
```

### API Endpoints (New)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /auth/login | - | Redirect ke osu! OAuth |
| GET | /auth/callback | - | OAuth callback handler |
| POST | /auth/logout | session | Logout user |
| GET | /auth/me | session | Get current user |
| GET | /queue/state | - | Get current queue state |
| POST | /queue/submit | - | Submit beatmap ke queue |
| GET | /queue/job/{id} | - | Get job status |
| GET | /analysis/playstyle | session | Fetch & analyze play history |
| GET | /recommend | session | Get map recommendations |
| POST | /admin/beatmap | API key | Manual upsert beatmap record |

---

## Data Models

### Database Schema

```sql
-- Users dari osu! OAuth
CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    osu_id      INTEGER UNIQUE NOT NULL,
    username    VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Server-side sessions
CREATE TABLE sessions (
    id           VARCHAR(64) PRIMARY KEY,  -- random token
    user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at   TIMESTAMP NOT NULL,
    created_at   TIMESTAMP DEFAULT NOW()
);

-- Queue items
CREATE TABLE queue_items (
    id          VARCHAR(64) PRIMARY KEY,   -- UUID
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status      VARCHAR(20) NOT NULL,      -- waiting, processing, done, failed
    input_type  VARCHAR(10) NOT NULL,      -- link, upload
    input_value TEXT NOT NULL,             -- URL atau filename
    result      JSONB,
    error       TEXT,
    position    INTEGER,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- Beatmap database
CREATE TABLE beatmaps (
    id           SERIAL PRIMARY KEY,
    beatmap_id   VARCHAR(20) UNIQUE NOT NULL,
    bpm          FLOAT,
    ar           FLOAT,
    cs           FLOAT,
    od           FLOAT,
    object_count INTEGER,
    predicted_at TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW()
);

-- Label per beatmap (many-to-many style)
CREATE TABLE beatmap_labels (
    id          SERIAL PRIMARY KEY,
    beatmap_id  VARCHAR(20) REFERENCES beatmaps(beatmap_id) ON DELETE CASCADE,
    label       VARCHAR(100) NOT NULL,
    probability FLOAT NOT NULL,
    UNIQUE(beatmap_id, label)
);
```

### Python/TypeScript Models

```python
# Backend Pydantic models
class QueueState(BaseModel):
    total_capacity: int = 5
    occupied_slots: int
    jobs: List[QueueJob]

class QueueJob(BaseModel):
    id: str
    status: Literal["waiting", "processing", "done", "failed"]
    position: Optional[int]
    result: Optional[dict]
    error: Optional[str]

class DominantPlaystyle(BaseModel):
    label: str
    average_probability: float
    beatmaps_analyzed: int

class BeatmapRecord(BaseModel):
    beatmap_id: str
    bpm: float
    ar: float
    cs: float
    od: float
    object_count: int
    labels: List[LabelResult]
```

```typescript
// Frontend types (tambahan di types.ts)
interface QueueState {
  total_capacity: number;
  occupied_slots: number;
  jobs: QueueJob[];
}

interface QueueJob {
  id: string;
  status: "waiting" | "processing" | "done" | "failed";
  position?: number;
}

interface CurrentUser {
  osu_id: number;
  username: string;
}

interface DominantPlaystyle {
  label: string;
  average_probability: number;
  beatmaps_analyzed: number;
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

**Property 1: Queue capacity invariant**
*For any* queue state and any submitted job, if the queue is at or above maximum capacity (5 slots), the submission must be rejected; if below capacity, the job must be added and the slot count increases by exactly 1.
**Validates: Requirements 1.2, 1.3, 1.4**

---

**Property 2: Queue slot release invariant**
*For any* queue containing N occupied slots, when any job transitions to "done" or "failed", the resulting queue must contain exactly N-1 occupied slots.
**Validates: Requirements 1.4**

---

**Property 3: Queue job status display completeness**
*For any* queue job in any valid status ("waiting", "processing", "done", "failed"), the rendered queue item component must display a non-empty status label matching the job's status field.
**Validates: Requirements 1.6**

---

**Property 4: OAuth session lifecycle**
*For any* valid OAuth callback response containing user_id, username, and access_token, after completing the login flow and then the logout flow, the session must no longer be valid (i.e. GET /auth/me returns 401).
**Validates: Requirements 2.2, 2.5**

---

**Property 5: Authenticated username display**
*For any* authenticated session with username X, the rendered NavBar component must contain the string X.
**Validates: Requirements 2.4**

---

**Property 6: Play history queue submission completeness**
*For any* list of N beatmaps from play history, after the full analysis flow completes (respecting queue batching), the total number of processed predictions must equal N minus the number of failed predictions.
**Validates: Requirements 3.3, 3.6**

---

**Property 7: Dominant playstyle calculation correctness**
*For any* non-empty collection of prediction results, the dominant playstyle returned by `calculate_dominant_playstyle` must be the label whose mean probability across all predictions is strictly greater than or equal to the mean probability of every other label.
**Validates: Requirements 3.4**

---

**Property 8: Recommendation label filter correctness**
*For any* playstyle label L and any beatmap database state, all beatmaps returned by `get_recommendations(L)` must have L as one of their associated labels in the database.
**Validates: Requirements 4.1**

---

**Property 9: Beatmap record round-trip**
*For any* valid PredictResult, calling `upsert_beatmap` then querying the DB by beatmap_id must return a record containing all fields: beatmap_id, bpm, ar, cs, od, object_count, all predicted labels with their probabilities, and a non-null timestamp.
**Validates: Requirements 4.4, 4.5, 5.2**

---

**Property 10: Beatmap upsert idempotency**
*For any* beatmap_id, inserting a prediction result twice must result in exactly 1 row in the beatmaps table for that beatmap_id (upsert, not duplicate insert).
**Validates: Requirements 5.3**

---

**Property 11: Queue persistence round-trip**
*For any* queue state containing active jobs, serializing that state to the database then calling `restore_from_db` must produce a queue state with the same set of job IDs and statuses.
**Validates: Requirements 5.5**

---

**Property 12: Unauthenticated prediction not linked to user**
*For any* prediction submitted without a valid session, the resulting queue_item record in the database must have a NULL user_id.
**Validates: Requirements 6.2**

---

## Error Handling

- **Queue full**: HTTP 429, body `{"detail": "Queue is full. Try again later."}`
- **OAuth failure**: Redirect ke `/?error=oauth_failed`
- **osu! API error**: HTTP 502, message forwarded ke client
- **Beatmap download failure**: Job di-mark `failed`, error disimpan di queue_items
- **Token expired**: Backend otomatis retry dengan refresh token sebelum return error ke client
- **DB connection loss**: HTTP 503 dengan retry hint

---

## Testing Strategy

### Property-Based Testing
Library yang digunakan: **Hypothesis** (Python) untuk backend, **fast-check** (TypeScript) untuk frontend.

Setiap property-based test wajib:
- Dijalankan minimum 100 iterasi
- Diberi tag komentar format: `# Feature: osu-playstyle-platform, Property {N}: {property_text}`
- Satu test per correctness property

### Unit Testing
- Backend: **pytest** dengan fixtures PostgreSQL in-memory (menggunakan `pytest-asyncio` + test database)
- Frontend: **Vitest** + **@testing-library/react**

### Coverage Areas
- QueueManager: semua transisi status, batas kapasitas
- AnalysisService: kalkulasi dominant playstyle dengan berbagai distribusi probabilitas
- RecommendationService: filter label, fallback ke secondary labels
- Auth: session lifecycle, token refresh
- DB: upsert idempotency, schema migration
