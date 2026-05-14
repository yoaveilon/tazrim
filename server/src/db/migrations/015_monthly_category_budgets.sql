CREATE TABLE IF NOT EXISTS monthly_category_budgets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    month       TEXT NOT NULL,  -- YYYY-MM
    category_id INTEGER NOT NULL,
    budget      REAL NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, month, category_id)
);
