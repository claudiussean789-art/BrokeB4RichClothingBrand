alter table public.wallet_orders
  add column if not exists tracking_number text,
  add column if not exists tracking_carrier text not null default 'Knutsford Express',
  add column if not exists tracking_updated_at timestamptz;

create or replace function public.is_store_admin()
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
    or exists (
      select 1 from auth.users
      where id = auth.uid()
        and lower(email) = 'champoohdarkshade@gmail.com'
        and email_confirmed_at is not null
    )
  );
$$;

revoke all on function public.is_store_admin() from public, anon;
grant execute on function public.is_store_admin() to authenticated;

create or replace function public.admin_list_orders()
returns setof public.wallet_orders
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_store_admin() then
    raise exception 'Admin access required.';
  end if;
  return query select * from public.wallet_orders order by created_at desc;
end;
$$;

create or replace function public.admin_set_order_fulfillment_status(p_order_id uuid, p_status text)
returns public.wallet_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.wallet_orders;
begin
  if not public.is_store_admin() then
    raise exception 'Admin access required.';
  end if;
  if p_status not in ('pending', 'in_progress', 'completed', 'failed') then
    raise exception 'Invalid status.';
  end if;
  update public.wallet_orders set fulfillment_status = p_status
  where id = p_order_id returning * into v_order;
  if not found then
    raise exception 'Order not found.';
  end if;
  return v_order;
end;
$$;

create or replace function public.admin_set_order_tracking(p_order_id uuid, p_tracking_number text)
returns public.wallet_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.wallet_orders;
  v_tracking text := nullif(btrim(p_tracking_number), '');
begin
  if not public.is_store_admin() then
    raise exception 'Admin access required.';
  end if;
  if v_tracking is not null and v_tracking !~ '^[A-Za-z0-9 -]{3,40}$' then
    raise exception 'Tracking number must be 3-40 letters, numbers, spaces or dashes.';
  end if;
  update public.wallet_orders
  set tracking_number = v_tracking,
      tracking_carrier = 'Knutsford Express',
      tracking_updated_at = now()
  where id = p_order_id returning * into v_order;
  if not found then
    raise exception 'Order not found.';
  end if;
  return v_order;
end;
$$;

create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  visitor_id text not null check (char_length(visitor_id) between 8 and 64),
  path text not null default '/' check (char_length(path) <= 200),
  created_at timestamptz not null default now()
);

create index if not exists site_visits_created_at_idx on public.site_visits (created_at desc);

alter table public.site_visits enable row level security;

create or replace function public.record_site_visit(p_visitor_id text, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_visitor_id is null or char_length(p_visitor_id) not between 8 and 64 then
    return;
  end if;
  insert into public.site_visits (visitor_id, path, user_id)
  values (p_visitor_id, left(coalesce(p_path, '/'), 200), auth.uid());
end;
$$;

create or replace function public.admin_site_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_result jsonb;
begin
  if not public.is_store_admin() then
    raise exception 'Admin access required.';
  end if;
  select jsonb_build_object(
    'visits_total', (select count(*) from public.site_visits),
    'visits_today', (select count(*) from public.site_visits where created_at >= date_trunc('day', now())),
    'visits_7d', (select count(*) from public.site_visits where created_at >= now() - interval '7 days'),
    'visitors_total', (select count(distinct visitor_id) from public.site_visits),
    'visitors_7d', (select count(distinct visitor_id) from public.site_visits where created_at >= now() - interval '7 days'),
    'customers_total', (select count(*) from public.profiles),
    'customers_7d', (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'orders_total', (select count(*) from public.wallet_orders),
    'revenue_total', (select coalesce(sum(total), 0) from public.wallet_orders where status <> 'cancelled')
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.admin_set_order_tracking(uuid, text) from public, anon;
revoke all on function public.admin_site_stats() from public, anon;
revoke all on function public.record_site_visit(text, text) from public;
grant execute on function public.admin_set_order_tracking(uuid, text) to authenticated;
grant execute on function public.admin_site_stats() to authenticated;
grant execute on function public.record_site_visit(text, text) to anon, authenticated;

-- Link visits to signed-in customers when known.
alter table public.site_visits
  add column if not exists user_id uuid references auth.users (id) on delete set null,
  add column if not exists referrer text check (char_length(referrer) <= 500);

create index if not exists site_visits_user_id_idx on public.site_visits (user_id);

drop policy if exists "Admins read site visits" on public.site_visits;
create policy "Admins read site visits" on public.site_visits
  for select to authenticated using (public.is_store_admin());

-- Daily store performance snapshot.
create table if not exists public.store_daily_metrics (
  day date primary key,
  visits integer not null default 0,
  unique_visitors integer not null default 0,
  new_customers integer not null default 0,
  orders integer not null default 0,
  revenue numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.store_daily_metrics enable row level security;

drop policy if exists "Admins read daily metrics" on public.store_daily_metrics;
create policy "Admins read daily metrics" on public.store_daily_metrics
  for select to authenticated using (public.is_store_admin());

create or replace function public.refresh_store_daily_metrics(p_day date default current_date)
returns public.store_daily_metrics
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.store_daily_metrics;
begin
  if not public.is_store_admin() then
    raise exception 'Admin access required.';
  end if;
  insert into public.store_daily_metrics (day, visits, unique_visitors, new_customers, orders, revenue, updated_at)
  values (
    p_day,
    (select count(*) from public.site_visits where created_at::date = p_day),
    (select count(distinct visitor_id) from public.site_visits where created_at::date = p_day),
    (select count(*) from public.profiles where created_at::date = p_day),
    (select count(*) from public.wallet_orders where created_at::date = p_day),
    (select coalesce(sum(total), 0) from public.wallet_orders where created_at::date = p_day and status <> 'cancelled'),
    now()
  )
  on conflict (day) do update
    set visits = excluded.visits,
        unique_visitors = excluded.unique_visitors,
        new_customers = excluded.new_customers,
        orders = excluded.orders,
        revenue = excluded.revenue,
        updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.refresh_store_daily_metrics(date) from public, anon;
grant execute on function public.refresh_store_daily_metrics(date) to authenticated;

-- Audit trail of admin changes to orders.
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  order_id uuid references public.wallet_orders (id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_order_idx on public.admin_audit_log (order_id, created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists "Admins read audit log" on public.admin_audit_log;
create policy "Admins read audit log" on public.admin_audit_log
  for select to authenticated using (public.is_store_admin());

create or replace function public.log_admin_order_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_store_admin() then
    return new;
  end if;
  if new.tracking_number is distinct from old.tracking_number then
    insert into public.admin_audit_log (admin_id, order_id, action, details)
    values (auth.uid(), new.id, 'tracking_updated',
      jsonb_build_object('from', old.tracking_number, 'to', new.tracking_number));
  end if;
  if new.fulfillment_status is distinct from old.fulfillment_status then
    insert into public.admin_audit_log (admin_id, order_id, action, details)
    values (auth.uid(), new.id, 'fulfillment_status_changed',
      jsonb_build_object('from', old.fulfillment_status, 'to', new.fulfillment_status));
  end if;
  return new;
end;
$$;

drop trigger if exists wallet_orders_admin_audit on public.wallet_orders;
create trigger wallet_orders_admin_audit
after update of tracking_number, fulfillment_status on public.wallet_orders
for each row execute function public.log_admin_order_change();
