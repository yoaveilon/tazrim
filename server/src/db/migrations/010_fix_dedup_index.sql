-- Fix dedup index: handle NULL card_last_four and include user_id
-- SQLite treats NULL != NULL in UNIQUE constraints, allowing duplicate transactions

-- Step 1: Remove duplicate transactions (keep lowest id per group)
DELETE FROM transactions WHERE id NOT IN (
  SELECT MIN(id) FROM transactions
  GROUP BY user_id, date, description, charged_amount, COALESCE(card_last_four, '')
);

-- Step 2: Drop old index that doesn't handle NULLs
DROP INDEX IF EXISTS idx_transactions_dedup;

-- Step 3: Create fixed index with COALESCE and user_id
CREATE UNIQUE INDEX idx_transactions_dedup
  ON transactions(user_id, date, description, charged_amount, COALESCE(card_last_four, ''));
