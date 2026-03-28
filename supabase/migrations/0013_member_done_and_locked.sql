-- Extend status constraint to include 'locked'
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_status_check;
ALTER TABLE public.bills ADD CONSTRAINT bills_status_check
  CHECK (status IN ('draft', 'uploaded', 'parsed', 'verified', 'locked'));

-- Add is_done to bill_members
ALTER TABLE public.bill_members ADD COLUMN is_done boolean NOT NULL DEFAULT false;

-- Allow members to update their own is_done
CREATE POLICY "bill_members_update_own" ON public.bill_members
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Lock guard on claims: block insert/update/delete when bill is locked
DROP POLICY IF EXISTS "bill_item_claims_insert" ON public.bill_item_claims;
CREATE POLICY "bill_item_claims_insert" ON public.bill_item_claims
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.line_items li
      JOIN public.bills b ON b.id = li.bill_id
      WHERE li.id = item_id
        AND is_bill_participant(li.bill_id, auth.uid())
        AND b.status <> 'locked'
    )
  );

DROP POLICY IF EXISTS "bill_item_claims_update" ON public.bill_item_claims;
CREATE POLICY "bill_item_claims_update" ON public.bill_item_claims
  FOR UPDATE USING (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.line_items li
      JOIN public.bills b ON b.id = li.bill_id
      WHERE li.id = item_id AND b.status <> 'locked'
    )
  );

DROP POLICY IF EXISTS "bill_item_claims_delete" ON public.bill_item_claims;
CREATE POLICY "bill_item_claims_delete" ON public.bill_item_claims
  FOR DELETE USING (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.line_items li
      JOIN public.bills b ON b.id = li.bill_id
      WHERE li.id = item_id AND b.status <> 'locked'
    )
  );
