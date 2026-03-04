ALTER TABLE public.profiles
  ADD COLUMN venmo_handle   text,
  ADD COLUMN zelle_id       text,
  ADD COLUMN cashapp_handle text,
  ADD COLUMN paypal_id      text;
