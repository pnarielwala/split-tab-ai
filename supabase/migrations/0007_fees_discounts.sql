-- Add fees and discounts columns to bill_totals
ALTER TABLE bill_totals ADD COLUMN IF NOT EXISTS fees numeric(10,2);
ALTER TABLE bill_totals ADD COLUMN IF NOT EXISTS discounts numeric(10,2);
