-- Re-target user_id FKs on bill_members and bill_item_claims from auth.users
-- to public.profiles so PostgREST can resolve the nested profiles(*) join.

alter table public.bill_members
  drop constraint bill_members_user_id_fkey,
  add constraint bill_members_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.bill_item_claims
  drop constraint bill_item_claims_user_id_fkey,
  add constraint bill_item_claims_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;
