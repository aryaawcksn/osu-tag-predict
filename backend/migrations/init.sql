-- osu! Playstyle Platform — initial schema
-- Run once against an empty PostgreSQL database.

-- Users populated via osu! OAuth
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    osu_id      INTEGER UNIQUE NOT NULL,
    username    VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Server-side sessions (session_id stored in httpOnly cookie)
CREATE TABLE IF NOT EXISTS sessions (
    id            VARCHAR(64) PRIMARY KEY,
    user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    access_token  TEXT NOT NULL,
    refresh_token TEXT,
    expires_at    TIMESTAMP NOT NULL,
    created_at    TIMESTAMP DEFAULT NOW()
);

-- Prediction queue items
CREATE TABLE IF NOT EXISTS queue_items (
    id          VARCHAR(64) PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status      VARCHAR(20) NOT NULL CHECK (status IN ('waiting','processing','done','failed')),
    input_type  VARCHAR(10) NOT NULL CHECK (input_type IN ('link','upload')),
    input_value TEXT NOT NULL,
    result      JSONB,
    error       TEXT,
    position    INTEGER,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- Beatmap database — one row per unique beatmap_id
CREATE TABLE IF NOT EXISTS beatmaps (
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

-- Playstyle labels per beatmap (many per beatmap)
CREATE TABLE IF NOT EXISTS beatmap_labels (
    id          SERIAL PRIMARY KEY,
    beatmap_id  VARCHAR(20) REFERENCES beatmaps(beatmap_id) ON DELETE CASCADE NOT NULL,
    label       VARCHAR(100) NOT NULL,
    probability FLOAT NOT NULL,
    UNIQUE (beatmap_id, label)
);

-- User tag votes (suggesting / voting correct tags)
CREATE TABLE IF NOT EXISTS beatmap_tag_votes (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    beatmap_id  VARCHAR(20) REFERENCES beatmaps(beatmap_id) ON DELETE CASCADE NOT NULL,
    tag         VARCHAR(100) NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, beatmap_id, tag)
);

