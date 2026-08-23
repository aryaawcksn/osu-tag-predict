-- Migration: add beatmapset_id to beatmaps, hidden_beatmapsets table
-- Run once against existing databases.

ALTER TABLE beatmaps ADD COLUMN IF NOT EXISTS beatmapset_id VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_beatmaps_beatmapset_id ON beatmaps(beatmapset_id);

CREATE TABLE IF NOT EXISTS hidden_beatmapsets (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    beatmapset_id VARCHAR(20) NOT NULL,
    hidden_at   TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, beatmapset_id)
);
