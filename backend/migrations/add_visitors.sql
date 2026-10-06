-- Migration: add visitors table for unique daily visitor tracking
CREATE TABLE IF NOT EXISTS visitors (
    id          SERIAL PRIMARY KEY,
    ip_hash     VARCHAR(64) NOT NULL,
    visit_date  VARCHAR(10) NOT NULL,
    first_seen  TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_visitor_ip_date UNIQUE (ip_hash, visit_date)
);
