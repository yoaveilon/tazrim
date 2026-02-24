-- Fix dedup: ignore description when detecting duplicates
-- Credit card companies sometimes change transaction descriptions between reports
-- (e.g., YANGO → NGO DELI), causing duplicates with different descriptions.

-- Step 1: Remove duplicates by date+amount+card (keep the newest = highest id)
DELETE FROM transactions WHERE id NOT IN (
  SELECT MAX(id) FROM transactions
  GROUP BY user_id, date, charged_amount, COALESCE(card_last_four, '')
);

-- Step 2: Drop old index that includes description
DROP INDEX IF EXISTS idx_transactions_dedup;

-- Step 3: Create new index WITHOUT description
CREATE UNIQUE INDEX idx_transactions_dedup
  ON transactions(user_id, date, charged_amount, COALESCE(card_last_four, ''));
