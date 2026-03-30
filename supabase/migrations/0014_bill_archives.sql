CREATE TABLE public.bill_archives (
  bill_id     uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  archived_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bill_id, user_id)
);

ALTER TABLE public.bill_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bill_archives_select" ON public.bill_archives
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "bill_archives_insert" ON public.bill_archives
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND is_bill_participant(bill_id, auth.uid())
  );

CREATE POLICY "bill_archives_delete" ON public.bill_archives
  FOR DELETE USING (user_id = auth.uid());
