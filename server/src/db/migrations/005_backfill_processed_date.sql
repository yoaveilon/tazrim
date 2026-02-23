-- Backfill processed_date for existing Isracard transactions
-- The source_file format is "XXXX_MM_YYYY.xlsx" (e.g. "9117_02_2026.xlsx")
-- Extract the billing month/year to set processed_date = YYYY-MM-01
UPDATE transactions
SET processed_date = substr(source_file, 9, 4) || '-' || substr(source_file, 6, 2) || '-01'
WHERE source_company = 'isracard'
  AND (processed_date IS NULL OR processed_date = '')
  AND source_file IS NOT NULL;
