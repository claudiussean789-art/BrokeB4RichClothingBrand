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
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.raw_user_meta_data ->> 'name', ''),
    lower(coalesce(new.raw_user_meta_data ->> 'username', '')),
    coalesce(nullif(new.raw_user_meta_data ->> 'phone', ''), new.phone, ''),
    coalesce(new.raw_user_meta_data ->> 'address', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
        username = coalesce(nullif(excluded.username, ''), public.profiles.username),
        phone = coalesce(nullif(excluded.phone, ''), public.profiles.phone),
        address = coalesce(nullif(excluded.address, ''), public.profiles.address),
        updated_at = now();
  return new;
end;
$$;
