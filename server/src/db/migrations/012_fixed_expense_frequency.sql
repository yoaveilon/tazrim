-- Add frequency support for fixed expenses (e.g., bimonthly)
-- frequency: 'monthly' (default) or 'bimonthly'
-- start_month: YYYY-MM anchor month for bimonthly calculation

ALTER TABLE fixed_expenses ADD COLUMN frequency TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE fixed_expenses ADD COLUMN start_month TEXT;
