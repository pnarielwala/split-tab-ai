-- Allow sponsors to delete their guests' claims
-- The original DELETE policy only checked user_id = auth.uid(), blocking guest claim deletions
-- (guest claims have user_id = NULL)

DROP POLICY IF EXISTS "bill_item_claims_delete" ON public.bill_item_claims;

CREATE POLICY "bill_item_claims_delete" ON public.bill_item_claims
  FOR DELETE USING (
    -- users can delete their own claims
    user_id = auth.uid()
    OR
    -- sponsors can delete their guests' claims
    (guest_id IS NOT NULL AND user_id IS NULL AND EXISTS (
      SELECT 1 FROM public.bill_guests bg
      WHERE bg.id = guest_id AND bg.sponsored_by = auth.uid()
    ))
  );
