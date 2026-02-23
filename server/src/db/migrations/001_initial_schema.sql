-- Categories for transaction classification
CREATE TABLE IF NOT EXISTS categories (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    icon            TEXT,
    color           TEXT NOT NULL DEFAULT '#6B7280',
    is_expense      INTEGER NOT NULL DEFAULT 1,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Keyword-based classification rules
CREATE TABLE IF NOT EXISTS classification_rules (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword         TEXT NOT NULL,
    category_id     INTEGER NOT NULL,
    priority        INTEGER NOT NULL DEFAULT 0,
    is_regex        INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rules_keyword ON classification_rules(keyword);

-- Credit card transaction records
CREATE TABLE IF NOT EXISTS transactions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    date                TEXT NOT NULL,
    processed_date      TEXT,
    description         TEXT NOT NULL,
    original_amount     REAL NOT NULL,
    original_currency   TEXT NOT NULL DEFAULT 'ILS',
    charged_amount      REAL NOT NULL,
    category_id         INTEGER,
    type                TEXT NOT NULL DEFAULT 'normal',
    installment_number  INTEGER,
    installment_total   INTEGER,
    card_last_four      TEXT,
    source_file         TEXT,
    source_company      TEXT,
    classification_method TEXT,
    notes               TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_processed_date ON transactions(processed_date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

-- Deduplication index
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_dedup
    ON transactions(date, description, charged_amount, card_last_four);

-- Recurring income sources
CREATE TABLE IF NOT EXISTS income_sources (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    amount          REAL NOT NULL,
    expected_day    INTEGER NOT NULL,
    is_active       INTEGER NOT NULL DEFAULT 1,
    notes           TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Actual income records per month
CREATE TABLE IF NOT EXISTS income_records (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    income_source_id    INTEGER NOT NULL,
    month               TEXT NOT NULL,
    expected_amount     REAL NOT NULL,
    actual_amount       REAL,
    received_date       TEXT,
    status              TEXT NOT NULL DEFAULT 'expected',
    notes               TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (income_source_id) REFERENCES income_sources(id) ON DELETE CASCADE,
    UNIQUE(income_source_id, month)
);

-- Recurring fixed expenses
CREATE TABLE IF NOT EXISTS fixed_expenses (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    amount          REAL NOT NULL,
    billing_day     INTEGER NOT NULL,
    category_id     INTEGER,
    is_active       INTEGER NOT NULL DEFAULT 1,
    notes           TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Application settings
CREATE TABLE IF NOT EXISTS settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL
);

-- File upload history
CREATE TABLE IF NOT EXISTS upload_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    filename        TEXT NOT NULL,
    source_company  TEXT,
    rows_total      INTEGER NOT NULL DEFAULT 0,
    rows_imported   INTEGER NOT NULL DEFAULT 0,
    rows_skipped    INTEGER NOT NULL DEFAULT 0,
    rows_failed     INTEGER NOT NULL DEFAULT 0,
    uploaded_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Seed default categories
-- ============================================================
INSERT OR IGNORE INTO categories (name, icon, color, is_expense, sort_order) VALUES
    ('מזון',       '🛒', '#22C55E', 1, 1),
    ('מסעדות',     '🍽️', '#F97316', 1, 2),
    ('דלק',        '⛽', '#EF4444', 1, 3),
    ('תקשורת',     '📱', '#3B82F6', 1, 4),
    ('ביגוד',      '👕', '#A855F7', 1, 5),
    ('בריאות',     '🏥', '#EC4899', 1, 6),
    ('חינוך',      '📚', '#14B8A6', 1, 7),
    ('בילויים',    '🎬', '#F59E0B', 1, 8),
    ('תחבורה',     '🚌', '#6366F1', 1, 9),
    ('ביטוח',      '🛡️', '#8B5CF6', 1, 10),
    ('דיור',       '🏠', '#06B6D4', 1, 11),
    ('מנויים',     '🔄', '#D946EF', 1, 12),
    ('אחר',        '📦', '#6B7280', 1, 13),
    ('משכורת',     '💰', '#10B981', 0, 1),
    ('פרילנס',     '💼', '#0EA5E9', 0, 2),
    ('השקעות',     '📈', '#F59E0B', 0, 3);

-- ============================================================
-- Seed default classification rules
-- ============================================================
INSERT OR IGNORE INTO classification_rules (keyword, category_id, priority) VALUES
    ('שופרסל',     (SELECT id FROM categories WHERE name='מזון'), 10),
    ('רמי לוי',    (SELECT id FROM categories WHERE name='מזון'), 10),
    ('מגה',        (SELECT id FROM categories WHERE name='מזון'), 8),
    ('ויקטורי',    (SELECT id FROM categories WHERE name='מזון'), 10),
    ('יוחננוף',    (SELECT id FROM categories WHERE name='מזון'), 10),
    ('אושר עד',    (SELECT id FROM categories WHERE name='מזון'), 10),
    ('חצי חינם',   (SELECT id FROM categories WHERE name='מזון'), 10),
    ('טיב טעם',    (SELECT id FROM categories WHERE name='מזון'), 10),
    ('AM PM',      (SELECT id FROM categories WHERE name='מזון'), 5),
    ('פז ',        (SELECT id FROM categories WHERE name='דלק'), 10),
    ('סונול',      (SELECT id FROM categories WHERE name='דלק'), 10),
    ('דלק',        (SELECT id FROM categories WHERE name='דלק'), 8),
    ('דור אלון',   (SELECT id FROM categories WHERE name='דלק'), 10),
    ('סלקום',      (SELECT id FROM categories WHERE name='תקשורת'), 10),
    ('פרטנר',      (SELECT id FROM categories WHERE name='תקשורת'), 10),
    ('פלאפון',     (SELECT id FROM categories WHERE name='תקשורת'), 10),
    ('HOT',        (SELECT id FROM categories WHERE name='תקשורת'), 8),
    ('בזק',        (SELECT id FROM categories WHERE name='תקשורת'), 10),
    ('גולן טלקום', (SELECT id FROM categories WHERE name='תקשורת'), 10),
    ('הראל',       (SELECT id FROM categories WHERE name='ביטוח'), 5),
    ('מגדל',       (SELECT id FROM categories WHERE name='ביטוח'), 5),
    ('כלל ביטוח',  (SELECT id FROM categories WHERE name='ביטוח'), 10),
    ('הפניקס',     (SELECT id FROM categories WHERE name='ביטוח'), 5),
    ('רב קו',      (SELECT id FROM categories WHERE name='תחבורה'), 10),
    ('GETT',       (SELECT id FROM categories WHERE name='תחבורה'), 10),
    ('יאנגו',      (SELECT id FROM categories WHERE name='תחבורה'), 10),
    ('רכבת',       (SELECT id FROM categories WHERE name='תחבורה'), 10),
    ('נטפליקס',    (SELECT id FROM categories WHERE name='מנויים'), 10),
    ('NETFLIX',    (SELECT id FROM categories WHERE name='מנויים'), 10),
    ('ספוטיפיי',   (SELECT id FROM categories WHERE name='מנויים'), 10),
    ('SPOTIFY',    (SELECT id FROM categories WHERE name='מנויים'), 10),
    -- Additional rules based on real transaction data
    ('סופר פארם',  (SELECT id FROM categories WHERE name='בריאות'), 10),
    ('YANGO',      (SELECT id FROM categories WHERE name='תחבורה'), 10),
    ('WOLT',       (SELECT id FROM categories WHERE name='מסעדות'), 10),
    ('ארומה',      (SELECT id FROM categories WHERE name='מסעדות'), 10),
    ('APPLE.COM',  (SELECT id FROM categories WHERE name='מנויים'), 10),
    ('GOOGLE ONE', (SELECT id FROM categories WHERE name='מנויים'), 10),
    ('CLAUDE.AI',  (SELECT id FROM categories WHERE name='מנויים'), 10),
    ('NYTIMES',    (SELECT id FROM categories WHERE name='מנויים'), 10),
    ('איקאה',      (SELECT id FROM categories WHERE name='דיור'), 8),
    ('IKEA',       (SELECT id FROM categories WHERE name='דיור'), 8),
    ('סלקום אנרג', (SELECT id FROM categories WHERE name='תקשורת'), 10),
    ('פז גז',      (SELECT id FROM categories WHERE name='דלק'), 10),
    ('מנורה מבטחי',(SELECT id FROM categories WHERE name='ביטוח'), 10),
    ('קרן מכבי',   (SELECT id FROM categories WHERE name='בריאות'), 10),
    ('PAYBOX',     (SELECT id FROM categories WHERE name='אחר'), 5),
    ('BIT',        (SELECT id FROM categories WHERE name='אחר'), 3),
    ('העברה בBIT', (SELECT id FROM categories WHERE name='אחר'), 5),
    ('חניון',      (SELECT id FROM categories WHERE name='תחבורה'), 8),
    ('אילנס רכבת', (SELECT id FROM categories WHERE name='תחבורה'), 10),
    ('סופר סופר',  (SELECT id FROM categories WHERE name='מזון'), 10),
    ('קמעונאות מזון', (SELECT id FROM categories WHERE name='מזון'), 10),
    ('מאפיי',      (SELECT id FROM categories WHERE name='מזון'), 8),
    ('UNIQLO',     (SELECT id FROM categories WHERE name='ביגוד'), 10),
    ('צומת ספרים', (SELECT id FROM categories WHERE name='חינוך'), 10),
    ('עירית',      (SELECT id FROM categories WHERE name='דיור'), 5),
    ('aliexpress', (SELECT id FROM categories WHERE name='אחר'), 5),
    ('ALIEXPRESS', (SELECT id FROM categories WHERE name='אחר'), 5);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('ai_enabled', 'false'),
    ('ai_provider', 'claude'),
    ('ai_api_key', '');
