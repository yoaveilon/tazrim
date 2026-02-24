-- Fix processed_date: recalculate from source_file with minus one month
-- The source_file format is "XXXX_MM_YYYY.xlsx" (e.g. "9117_03_2026.xlsx")
-- MM/YYYY is the billing month, but transactions belong to the PREVIOUS month.
-- E.g. "9117_03_2026.xlsx" (billing March) → processed_date = 2026-02-01 (February)
UPDATE transactions
SET processed_date = date(
  substr(source_file, 9, 4) || '-' || substr(source_file, 6, 2) || '-01',
  '-1 month'
)
WHERE source_company = 'isracard'
  AND source_file IS NOT NULL;
