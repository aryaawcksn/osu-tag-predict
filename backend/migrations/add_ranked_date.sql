-- Migration: add ranked_date column to beatmaps table
ALTER TABLE beatmaps ADD COLUMN IF NOT EXISTS ranked_date VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_beatmaps_ranked_date ON beatmaps(ranked_date);
