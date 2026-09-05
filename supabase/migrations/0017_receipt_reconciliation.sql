-- Store the parser's reading of the receipt's own printed totals.
--
-- These are kept separate from bill_totals because bill_totals holds the
-- user-editable working values: updateBillTotals() upserts that row, which
-- replaces every column, so anything stored there would be wiped the first
-- time someone edits tax or gratuity. These columns are written once at parse
-- time and are never touched by user edits, which is what lets us compare the
-- line items against what the receipt actually said.

ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS receipt_subtotal numeric(10,2);
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS receipt_total numeric(10,2);

COMMENT ON COLUMN public.bills.receipt_subtotal IS
  'Subtotal as printed on the receipt, per the parser. Compared against the sum of line_items to detect dropped or misread rows. Null when unparsed or not identifiable.';
COMMENT ON COLUMN public.bills.receipt_total IS
  'Total as printed on the receipt, per the parser. Null when unparsed or not identifiable.';
