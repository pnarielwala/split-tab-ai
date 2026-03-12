ALTER TABLE public.bills
  ADD COLUMN payer_id uuid REFERENCES auth.users(id);

UPDATE public.bills SET payer_id = owner_id WHERE payer_id IS NULL;

ALTER TABLE public.bills ALTER COLUMN payer_id SET NOT NULL;
