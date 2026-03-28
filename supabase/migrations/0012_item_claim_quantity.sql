alter table public.bill_item_claims
  add column quantity_claimed numeric(10,2) not null default 1;

-- Allow users to update their own claims (e.g. change quantity_claimed)
create policy "bill_item_claims_update" on public.bill_item_claims
  for update using (user_id = auth.uid());
