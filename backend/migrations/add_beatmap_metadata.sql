-- Migration: add osu! metadata + model_version columns to beatmaps table
-- Run once against existing databases.

ALTER TABLE beatmaps ADD COLUMN IF NOT EXISTS title             TEXT;
ALTER TABLE beatmaps ADD COLUMN IF NOT EXISTS artist            TEXT;
ALTER TABLE beatmaps ADD COLUMN IF NOT EXISTS version           TEXT;
ALTER TABLE beatmaps ADD COLUMN IF NOT EXISTS difficulty_rating FLOAT;
ALTER TABLE beatmaps ADD COLUMN IF NOT EXISTS status            VARCHAR(20);
ALTER TABLE beatmaps ADD COLUMN IF NOT EXISTS cover_url         TEXT;
ALTER TABLE beatmaps ADD COLUMN IF NOT EXISTS card_url          TEXT;
ALTER TABLE beatmaps ADD COLUMN IF NOT EXISTS list_url          TEXT;
ALTER TABLE beatmaps ADD COLUMN IF NOT EXISTS model_version     VARCHAR(20);

-- Add avatar_url to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Hidden beatmaps per user (for recommendation blacklist)
CREATE TABLE IF NOT EXISTS hidden_beatmaps (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    beatmap_id  VARCHAR(20) NOT NULL,
    hidden_at   TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, beatmap_id)
);
