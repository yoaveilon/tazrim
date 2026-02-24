-- Fix foreign currency transactions where charged_amount was not converted to ILS
-- Uses default USD rate of 3.6 and EUR rate of 3.9
-- This handles transactions where the card company didn't provide an ILS amount

UPDATE transactions
SET charged_amount = ROUND(original_amount * 3.6, 2)
WHERE original_currency = 'USD'
  AND charged_amount = original_amount;

UPDATE transactions
SET charged_amount = ROUND(original_amount * 3.9, 2)
WHERE original_currency = 'EUR'
  AND charged_amount = original_amount;

UPDATE transactions
SET charged_amount = ROUND(original_amount * 4.5, 2)
WHERE original_currency = 'GBP'
  AND charged_amount = original_amount;
