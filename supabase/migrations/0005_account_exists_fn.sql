-- Returns true if a profile exists with the given phone or email.
-- security definer so it bypasses RLS and can be called by unauthenticated users.
create or replace function public.check_account_exists(
  p_phone text default null,
  p_email text default null
)
returns boolean
language plpgsql
security definer
as $$
begin
  if p_phone is not null then
    return exists (select 1 from public.profiles where phone = p_phone);
  elsif p_email is not null then
    return exists (select 1 from public.profiles where email = lower(trim(p_email)));
  end if;
  return false;
end;
$$;

grant execute on function public.check_account_exists to anon, authenticated;
