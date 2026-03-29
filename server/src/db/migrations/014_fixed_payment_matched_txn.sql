-- Track which fixed expense payment was auto-matched to a credit card transaction
-- When matched_transaction_id IS NOT NULL, the payment amount is already counted
-- via the transactions table and should not be double-counted in dashboards.
ALTER TABLE fixed_expense_payments ADD COLUMN matched_transaction_id INTEGER REFERENCES transactions(id);

-- Backfill: match existing payments to their credit card transactions
-- by finding transactions with matching amount in the same month
UPDATE fixed_expense_payments
SET matched_transaction_id = (
    SELECT t.id FROM transactions t
    JOIN fixed_expenses fe ON fe.id = fixed_expense_payments.fixed_expense_id
    WHERE t.user_id = fixed_expense_payments.user_id
      AND strftime('%Y-%m', COALESCE(t.processed_date, t.date)) = fixed_expense_payments.month
      AND t.charged_amount = fixed_expense_payments.amount_paid
      AND t.charged_amount > 0
      AND (LOWER(TRIM(t.description)) LIKE '%' || LOWER(TRIM(fe.name)) || '%'
           OR LOWER(TRIM(fe.name)) LIKE '%' || LOWER(TRIM(t.description)) || '%')
    LIMIT 1
)
WHERE matched_transaction_id IS NULL;
