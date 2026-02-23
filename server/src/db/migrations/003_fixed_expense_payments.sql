-- Track monthly payments for fixed expenses that don't go through credit card
-- Each row = one fixed expense was paid in a specific month
CREATE TABLE IF NOT EXISTS fixed_expense_payments (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    fixed_expense_id  INTEGER NOT NULL,
    month             TEXT NOT NULL,  -- YYYY-MM format
    amount_paid       REAL NOT NULL,  -- actual amount paid (may differ from fixed amount)
    paid_at           TEXT NOT NULL DEFAULT (datetime('now')),
    user_id           INTEGER NOT NULL,
    FOREIGN KEY (fixed_expense_id) REFERENCES fixed_expenses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(fixed_expense_id, month)
);

CREATE INDEX IF NOT EXISTS idx_fep_month ON fixed_expense_payments(month);
CREATE INDEX IF NOT EXISTS idx_fep_user ON fixed_expense_payments(user_id);
