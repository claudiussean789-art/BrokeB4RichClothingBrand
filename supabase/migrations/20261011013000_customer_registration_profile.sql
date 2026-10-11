alter table public.profiles
  add column if not exists username text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists address text not null default '';

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username <> '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, username, phone, address)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    lower(coalesce(new.raw_user_meta_data ->> 'username', '')),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'address', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        username = excluded.username,
        phone = excluded.phone,
        address = excluded.address,
        updated_at = now();
  return new;
end;
$$;
