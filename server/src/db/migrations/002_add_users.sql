-- Users table for Google OAuth
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id   TEXT NOT NULL UNIQUE,
    email       TEXT NOT NULL,
    name        TEXT NOT NULL,
    picture     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Add user_id to all per-user tables
ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE income_sources ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE fixed_expenses ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE classification_rules ADD COLUMN user_id INTEGER;
ALTER TABLE upload_history ADD COLUMN user_id INTEGER REFERENCES users(id);

-- Settings: need to recreate table since key is PRIMARY KEY
-- and we need a composite unique on (key, user_id)
CREATE TABLE IF NOT EXISTS settings_new (
    key             TEXT NOT NULL,
    value           TEXT NOT NULL,
    user_id         INTEGER,
    UNIQUE(key, user_id)
);

-- Copy existing settings (will be assigned to users when they log in)
INSERT OR IGNORE INTO settings_new (key, value) SELECT key, value FROM settings;
DROP TABLE settings;
ALTER TABLE settings_new RENAME TO settings;

-- Indexes for user_id filtering
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_income_sources_user ON income_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user ON fixed_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_classification_rules_user ON classification_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_history_user ON upload_history(user_id);
