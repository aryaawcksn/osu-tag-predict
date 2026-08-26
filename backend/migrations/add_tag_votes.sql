-- Migration: add beatmap tag votes table
CREATE TABLE IF NOT EXISTS beatmap_tag_votes (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    beatmap_id  VARCHAR(20) REFERENCES beatmaps(beatmap_id) ON DELETE CASCADE NOT NULL,
    tag         VARCHAR(100) NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, beatmap_id, tag)
);
