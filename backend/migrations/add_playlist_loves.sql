-- Migration: add playlist loves (favorites) table
-- Also adds love_count cache and snapshot_hash to playlists

ALTER TABLE playlists
    ADD COLUMN IF NOT EXISTS love_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS snapshot_hash TEXT;

CREATE TABLE IF NOT EXISTS playlist_loves (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    loved_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    -- hash of playlist content at time of love (to detect updates)
    snapshot_hash TEXT,
    CONSTRAINT uq_playlist_love UNIQUE (user_id, playlist_id)
);

CREATE INDEX IF NOT EXISTS idx_playlist_loves_playlist ON playlist_loves(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_loves_user ON playlist_loves(user_id);
