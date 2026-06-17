-- Portfolio Tracker schema for Supabase Postgres.
-- Run this in the Supabase SQL editor. The backend also auto-creates tables on
-- startup via SQLAlchemy, so this file is primarily for reference / manual setup.

CREATE TABLE IF NOT EXISTS watchlists (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watchlist_items (
    id              SERIAL PRIMARY KEY,
    watchlist_id    INTEGER NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    instrument_key  VARCHAR(64) NOT NULL,
    symbol          VARCHAR(64) NOT NULL,
    name            VARCHAR(255) DEFAULT '',
    sort_order      INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_watchlist_items_watchlist_id ON watchlist_items(watchlist_id);

CREATE TABLE IF NOT EXISTS holdings (
    id              SERIAL PRIMARY KEY,
    instrument_key  VARCHAR(64) NOT NULL,
    symbol          VARCHAR(64) NOT NULL,
    name            VARCHAR(255) DEFAULT '',
    quantity        DOUBLE PRECISION NOT NULL,
    avg_buy_price   DOUBLE PRECISION NOT NULL,
    sector          VARCHAR(120),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instrument_meta (
    instrument_key  VARCHAR(64) PRIMARY KEY,
    symbol          VARCHAR(64) NOT NULL,
    name            VARCHAR(255) DEFAULT '',
    exchange        VARCHAR(16) DEFAULT '',
    segment         VARCHAR(32) DEFAULT '',
    instrument_type VARCHAR(16) DEFAULT '',
    board_type      VARCHAR(16) DEFAULT 'MAINBOARD',
    sector          VARCHAR(120),
    tags            JSONB DEFAULT '[]'::jsonb,
    notes           TEXT DEFAULT '',
    rev_growth_year       DOUBLE PRECISION,
    rev_growth_quarter    DOUBLE PRECISION,
    profit_growth_year    DOUBLE PRECISION,
    profit_growth_quarter DOUBLE PRECISION
);

-- Existing DBs created before tags/notes were added: run once.
-- ALTER TABLE instrument_meta ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
-- ALTER TABLE instrument_meta ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
-- Existing DBs created before the manual growth fields were added: run once.
-- ALTER TABLE instrument_meta ADD COLUMN IF NOT EXISTS rev_growth_year DOUBLE PRECISION;
-- ALTER TABLE instrument_meta ADD COLUMN IF NOT EXISTS rev_growth_quarter DOUBLE PRECISION;
-- ALTER TABLE instrument_meta ADD COLUMN IF NOT EXISTS profit_growth_year DOUBLE PRECISION;
-- ALTER TABLE instrument_meta ADD COLUMN IF NOT EXISTS profit_growth_quarter DOUBLE PRECISION;

-- ---------------------------------------------------------------------------
-- Future-ready stub tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_insights (
    id              SERIAL PRIMARY KEY,
    instrument_key  VARCHAR(64),
    kind            VARCHAR(64) DEFAULT 'summary',
    content         TEXT DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ai_insights_instrument_key ON ai_insights(instrument_key);

CREATE TABLE IF NOT EXISTS financials (
    id              SERIAL PRIMARY KEY,
    instrument_key  VARCHAR(64),
    period          VARCHAR(32) DEFAULT '',
    metric          VARCHAR(64) DEFAULT '',
    value           DOUBLE PRECISION
);
CREATE INDEX IF NOT EXISTS ix_financials_instrument_key ON financials(instrument_key);

CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(255) DEFAULT '',
    body        TEXT DEFAULT '',
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alert_rules (
    id              SERIAL PRIMARY KEY,
    instrument_key  VARCHAR(64),
    condition       VARCHAR(32) DEFAULT 'price_above',
    threshold       DOUBLE PRECISION DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_alert_rules_instrument_key ON alert_rules(instrument_key);
