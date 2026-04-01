-- Guest table
CREATE TABLE public.bill_guests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id      uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  name         text NOT NULL,
  sponsored_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at   timestamptz DEFAULT now()
);

-- Extend claims: user_id nullable, add guest_id
ALTER TABLE public.bill_item_claims
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN guest_id uuid REFERENCES public.bill_guests(id) ON DELETE CASCADE;

-- Exactly one of user_id / guest_id must be set
ALTER TABLE public.bill_item_claims
  ADD CONSTRAINT one_claimer CHECK (num_nonnulls(user_id, guest_id) = 1);

-- Drop old unique constraint, replace with partial unique indexes
ALTER TABLE public.bill_item_claims
  DROP CONSTRAINT IF EXISTS bill_item_claims_item_id_user_id_key;

CREATE UNIQUE INDEX bill_item_claims_user_unique
  ON public.bill_item_claims (item_id, user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX bill_item_claims_guest_unique
  ON public.bill_item_claims (item_id, guest_id) WHERE guest_id IS NOT NULL;

-- RLS for bill_guests
ALTER TABLE public.bill_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view guests"
  ON public.bill_guests FOR SELECT
  USING (is_bill_participant(bill_id, auth.uid()));

CREATE POLICY "Members can add their own guests"
  ON public.bill_guests FOR INSERT
  WITH CHECK (
    sponsored_by = auth.uid()
    AND is_bill_participant(bill_id, auth.uid())
  );

CREATE POLICY "Sponsors can delete their guests"
  ON public.bill_guests FOR DELETE
  USING (sponsored_by = auth.uid());

-- Update bill_item_claims INSERT policy to allow guest claims
DROP POLICY IF EXISTS "Participants can claim items" ON public.bill_item_claims;

CREATE POLICY "Participants can claim items"
  ON public.bill_item_claims FOR INSERT
  WITH CHECK (
    -- user claiming for themselves
    (user_id = auth.uid() AND guest_id IS NULL)
    OR
    -- sponsor claiming for their guest
    (guest_id IS NOT NULL AND user_id IS NULL AND EXISTS (
      SELECT 1 FROM public.bill_guests bg
      WHERE bg.id = guest_id AND bg.sponsored_by = auth.uid()
    ))
  );
