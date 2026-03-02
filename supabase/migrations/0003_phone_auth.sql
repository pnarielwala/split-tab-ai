-- Make email nullable (phone-only users have no email)
alter table public.profiles
  alter column email drop not null;

-- Allow users to insert/upsert their own profile row
-- (needed for SignupForm to write display_name after OTP verification)
create policy "profiles_insert" on public.profiles
  for insert with check (id = auth.uid());

-- Update trigger to handle phone users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    case
      when new.email is not null then split_part(new.email, '@', 1)
      when new.phone is not null then new.phone
      else 'User'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;
