-- ============================================================
-- Phase 2: Bill Sharing & Item Splitting
-- ============================================================

-- ── Profiles (auto-populated from auth.users) ────────────────────────────────

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text not null
);

alter table public.profiles enable row level security;

create policy "profiles_select" on public.profiles
  for select using (auth.uid() is not null);

create policy "profiles_update" on public.profiles
  for update using (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Bill members ──────────────────────────────────────────────────────────────

create table public.bill_members (
  id        uuid primary key default uuid_generate_v4(),
  bill_id   uuid not null references public.bills(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (bill_id, user_id)
);

alter table public.bill_members enable row level security;

-- ── Bill item claims ──────────────────────────────────────────────────────────

create table public.bill_item_claims (
  id         uuid primary key default uuid_generate_v4(),
  item_id    uuid not null references public.line_items(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  unique (item_id, user_id)
);

alter table public.bill_item_claims enable row level security;

-- ── Helper function ───────────────────────────────────────────────────────────

create or replace function public.is_bill_participant(p_bill_id uuid, p_user_id uuid)
returns boolean as $$
  select exists (select 1 from public.bills where id = p_bill_id and owner_id = p_user_id)
      or exists (select 1 from public.bill_members where bill_id = p_bill_id and user_id = p_user_id);
$$ language sql security definer stable;

-- ── RLS policy updates ────────────────────────────────────────────────────────

-- Bills SELECT: any authenticated user can read by UUID (share-link model)
drop policy if exists "bills_select" on public.bills;
create policy "bills_select" on public.bills
  for select using (auth.uid() is not null);

-- Line items SELECT: participants only
drop policy if exists "line_items_select" on public.line_items;
create policy "line_items_select" on public.line_items
  for select using (is_bill_participant(bill_id, auth.uid()));

-- Bill totals SELECT: participants only
drop policy if exists "bill_totals_select" on public.bill_totals;
create policy "bill_totals_select" on public.bill_totals
  for select using (is_bill_participant(bill_id, auth.uid()));

-- Bill members RLS
create policy "bill_members_select" on public.bill_members
  for select using (is_bill_participant(bill_id, auth.uid()));

create policy "bill_members_insert" on public.bill_members
  for insert with check (user_id = auth.uid());

create policy "bill_members_delete" on public.bill_members
  for delete using (user_id = auth.uid());

-- Bill item claims RLS
create policy "bill_item_claims_select" on public.bill_item_claims
  for select using (
    exists (
      select 1 from public.line_items li
      where li.id = item_id and is_bill_participant(li.bill_id, auth.uid())
    )
  );

create policy "bill_item_claims_insert" on public.bill_item_claims
  for insert with check (
    user_id = auth.uid() and
    exists (
      select 1 from public.line_items li
      where li.id = item_id and is_bill_participant(li.bill_id, auth.uid())
    )
  );

create policy "bill_item_claims_delete" on public.bill_item_claims
  for delete using (user_id = auth.uid());
