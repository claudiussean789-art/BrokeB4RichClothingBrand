create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, username, phone, address, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.raw_user_meta_data ->> 'name', ''),
    lower(coalesce(new.raw_user_meta_data ->> 'username', '')),
    coalesce(nullif(new.raw_user_meta_data ->> 'phone', ''), new.phone, ''),
    coalesce(new.raw_user_meta_data ->> 'address', ''),
    nullif(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
        username = coalesce(nullif(excluded.username, ''), public.profiles.username),
        phone = coalesce(nullif(excluded.phone, ''), public.profiles.phone),
        address = coalesce(nullif(excluded.address, ''), public.profiles.address),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();
  return new;
end;
$$;

alter table public.profiles
  add column if not exists avatar_url text;

-- One row per sign-in method (email, phone, google, ...) a customer uses.
create table if not exists public.customer_auth_methods (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (char_length(provider) between 2 and 40),
  email text,
  phone text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.customer_auth_methods enable row level security;

drop policy if exists "Users read own auth methods" on public.customer_auth_methods;
create policy "Users read own auth methods" on public.customer_auth_methods
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Admins read auth methods" on public.customer_auth_methods;
create policy "Admins read auth methods" on public.customer_auth_methods
  for select to authenticated using (public.is_store_admin());

create or replace function public.sync_customer_auth_methods()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.customer_auth_methods (user_id, provider, email, phone, verified)
  select
    new.id,
    p.provider,
    nullif(new.email, ''),
    nullif(new.phone, ''),
    case p.provider
      when 'phone' then new.phone_confirmed_at is not null
      else new.email_confirmed_at is not null
    end
  from (
    select distinct provider from (
      select jsonb_array_elements_text(
        case when jsonb_typeof(new.raw_app_meta_data -> 'providers') = 'array'
          then new.raw_app_meta_data -> 'providers' else '[]'::jsonb end) as provider
      union all
      select coalesce(new.raw_app_meta_data ->> 'provider', case when new.phone is not null and new.email is null then 'phone' else 'email' end)
    ) raw
  ) p
  on conflict (user_id, provider) do update
    set email = excluded.email,
        phone = excluded.phone,
        verified = excluded.verified,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_sync_methods on auth.users;
create trigger on_auth_user_sync_methods
after insert or update of raw_app_meta_data, phone, phone_confirmed_at, email_confirmed_at on auth.users
for each row execute function public.sync_customer_auth_methods();

-- Backfill existing users.
update auth.users set raw_app_meta_data = raw_app_meta_data;
