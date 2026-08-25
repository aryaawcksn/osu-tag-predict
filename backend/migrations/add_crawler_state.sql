-- Migration: persist backfill cursor across restarts
CREATE TABLE IF NOT EXISTS crawler_state (
    key            VARCHAR(40) PRIMARY KEY,
    cursor_string  TEXT,
    done           INTEGER NOT NULL DEFAULT 0,
    updated_at     TIMESTAMP DEFAULT NOW()
);
