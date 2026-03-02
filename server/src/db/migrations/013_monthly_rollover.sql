-- Monthly rollover: carry over unused budget from previous month
CREATE TABLE IF NOT EXISTS monthly_rollover (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  month TEXT NOT NULL,
  source_month TEXT NOT NULL,
  rollover_amount REAL NOT NULL DEFAULT 0,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, month)
);
