-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- Tables
-- ============================================================

create table public.bills (
  id           uuid primary key default uuid_generate_v4(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  description  text,
  status       text not null default 'draft'
               check (status in ('draft', 'uploaded', 'parsed', 'verified')),
  receipt_path text,
  receipt_url  text
);

create table public.line_items (
  id           uuid primary key default uuid_generate_v4(),
  bill_id      uuid not null references public.bills(id) on delete cascade,
  name         text not null,
  quantity     numeric(10,2) not null default 1,
  unit_price   numeric(10,2) not null,
  total_price  numeric(10,2) not null,
  sort_order   integer not null default 0
);

create table public.bill_totals (
  bill_id   uuid primary key references public.bills(id) on delete cascade,
  subtotal  numeric(10,2),
  tax       numeric(10,2),
  gratuity  numeric(10,2),
  total     numeric(10,2),
  currency  text not null default 'USD'
);

-- ============================================================
-- Updated_at trigger for bills
-- ============================================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger bills_updated_at
  before update on public.bills
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.bills enable row level security;
alter table public.line_items enable row level security;
alter table public.bill_totals enable row level security;

-- Bills: owner only
create policy "bills_select" on public.bills
  for select using (owner_id = auth.uid());

create policy "bills_insert" on public.bills
  for insert with check (owner_id = auth.uid());

create policy "bills_update" on public.bills
  for update using (owner_id = auth.uid());

create policy "bills_delete" on public.bills
  for delete using (owner_id = auth.uid());

-- Line items: join-based owner check
create policy "line_items_select" on public.line_items
  for select using (
    exists (select 1 from public.bills where bills.id = line_items.bill_id and bills.owner_id = auth.uid())
  );

create policy "line_items_insert" on public.line_items
  for insert with check (
    exists (select 1 from public.bills where bills.id = line_items.bill_id and bills.owner_id = auth.uid())
  );

create policy "line_items_update" on public.line_items
  for update using (
    exists (select 1 from public.bills where bills.id = line_items.bill_id and bills.owner_id = auth.uid())
  );

create policy "line_items_delete" on public.line_items
  for delete using (
    exists (select 1 from public.bills where bills.id = line_items.bill_id and bills.owner_id = auth.uid())
  );

-- Bill totals: join-based owner check
create policy "bill_totals_select" on public.bill_totals
  for select using (
    exists (select 1 from public.bills where bills.id = bill_totals.bill_id and bills.owner_id = auth.uid())
  );

create policy "bill_totals_insert" on public.bill_totals
  for insert with check (
    exists (select 1 from public.bills where bills.id = bill_totals.bill_id and bills.owner_id = auth.uid())
  );

create policy "bill_totals_update" on public.bill_totals
  for update using (
    exists (select 1 from public.bills where bills.id = bill_totals.bill_id and bills.owner_id = auth.uid())
  );

create policy "bill_totals_delete" on public.bill_totals
  for delete using (
    exists (select 1 from public.bills where bills.id = bill_totals.bill_id and bills.owner_id = auth.uid())
  );

-- ============================================================
-- Storage: receipts bucket
-- ============================================================
-- Run this in the Supabase dashboard Storage section or via API:
-- Bucket: receipts, public: true, file size limit: 5242880 (5MB)
-- Allowed mime types: image/jpeg, image/png, image/webp

-- Storage RLS policies (apply after creating bucket via dashboard)
-- INSERT: authenticated users can upload to their own folder
create policy "receipts_insert" on storage.objects
  for insert with check (
    bucket_id = 'receipts' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- SELECT: authenticated users can view their own receipts
create policy "receipts_select" on storage.objects
  for select using (
    bucket_id = 'receipts' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- DELETE: authenticated users can delete their own receipts
create policy "receipts_delete" on storage.objects
  for delete using (
    bucket_id = 'receipts' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
