-- Backfill processed_date for existing Isracard transactions
-- The source_file format is "XXXX_MM_YYYY.xlsx" (e.g. "9117_03_2026.xlsx")
-- The billing month (MM/YYYY in filename) is when the charge hits the account,
-- but the transactions belong to the PREVIOUS month's cashflow.
-- E.g. file "9117_03_2026.xlsx" = billing March 2026 = February 2026 expenses.
-- So we set processed_date to one month BEFORE the billing month.
UPDATE transactions
SET processed_date = date(
  substr(source_file, 9, 4) || '-' || substr(source_file, 6, 2) || '-01',
  '-1 month'
)
WHERE source_company = 'isracard'
  AND (processed_date IS NULL OR processed_date = '')
  AND source_file IS NOT NULL;
