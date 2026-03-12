-- bill_payments: tracks who has paid back the payer
CREATE TABLE bill_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id uuid REFERENCES bills(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) NOT NULL,
  paid_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(bill_id, user_id)
);

ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;

-- SELECT: any participant can see payment status for their bill
CREATE POLICY "Participants can view payment status"
  ON bill_payments FOR SELECT
  USING (is_bill_participant(bill_id, auth.uid()));

-- INSERT: participant can mark themselves paid, or payer can mark any participant
CREATE POLICY "Participants can mark paid"
  ON bill_payments FOR INSERT
  WITH CHECK (
    is_bill_participant(bill_id, auth.uid())
    AND (
      user_id = auth.uid()
      OR (
        SELECT payer_id FROM bills WHERE id = bill_id
      ) = auth.uid()
    )
  );

-- DELETE: participant can unmark themselves, or payer can unmark any participant
CREATE POLICY "Participants can unmark paid"
  ON bill_payments FOR DELETE
  USING (
    is_bill_participant(bill_id, auth.uid())
    AND (
      user_id = auth.uid()
      OR (
        SELECT payer_id FROM bills WHERE id = bill_id
      ) = auth.uid()
    )
  );
