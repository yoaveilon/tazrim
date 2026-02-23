-- Manual forecast overrides per category per user
-- When set, this value overrides the historical average for forecasting
CREATE TABLE IF NOT EXISTS category_forecast_overrides (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id     INTEGER NOT NULL,
    user_id         INTEGER NOT NULL,
    monthly_budget  REAL NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(category_id, user_id)
);
