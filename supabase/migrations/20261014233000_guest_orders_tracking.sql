alter table public.wallet_orders alter column user_id drop not null;

create or replace function public.order_display_status(p_tracking text, p_fulfillment text)
returns text
language sql
immutable
as $$
  select case
    when p_fulfillment = 'failed' then 'cancelled'
    when p_tracking is not null and btrim(p_tracking) <> '' then 'shipped'
    when p_fulfillment = 'completed' then 'completed'
    else 'processing'
  end;
$$;

create or replace function public.create_guest_order(p_items jsonb, p_customer jsonb, p_payment_method text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_total numeric(12, 2) := 0;
  v_price numeric;
  v_order public.wallet_orders;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'Your cart is empty.';
  end if;
  if jsonb_typeof(p_customer) <> 'object' then
    raise exception 'Customer information is required.';
  end if;
  if p_payment_method not in ('manual', 'local', 'payoneer', 'wipay') then
    raise exception 'Unsupported order payment method.';
  end if;
  if coalesce(btrim(p_customer ->> 'email'), '') = '' or coalesce(btrim(p_customer ->> 'phone'), '') = '' then
    raise exception 'Email and phone are required to track your order.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    select price into v_price from public.wallet_catalog_prices
    where id = v_item ->> 'id' and kind = v_item ->> 'kind' and active;
    if v_price is null then
      v_price := least(greatest(coalesce((v_item ->> 'unit_price')::numeric, 0), 0), 10000);
    end if;
    v_total := v_total + v_price;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', left(coalesce(v_item ->> 'id', ''), 100),
      'kind', left(coalesce(v_item ->> 'kind', 'wholesale'), 30),
      'name', left(coalesce(v_item ->> 'name', 'Item'), 200),
      'unit_price', v_price
    ));
  end loop;

  insert into public.wallet_orders (user_id, items, customer, total, payment_method, status)
  values (auth.uid(), v_items, p_customer, v_total, p_payment_method, 'requested')
  returning * into v_order;

  return jsonb_build_object('id', v_order.id, 'total', v_order.total);
end;
$$;

create or replace function public.lookup_guest_orders(p_email text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if coalesce(btrim(p_email), '') = '' or char_length(v_phone) < 7 then
    raise exception 'Enter the email and phone number used on the order.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id,
      'created_at', o.created_at,
      'total', o.total,
      'payment_method', o.payment_method,
      'items', o.items,
      'tracking_number', o.tracking_number,
      'tracking_carrier', o.tracking_carrier,
      'display_status', public.order_display_status(o.tracking_number, o.fulfillment_status)
    ) order by o.created_at desc)
    from public.wallet_orders o
    where lower(o.customer ->> 'email') = lower(btrim(p_email))
      and regexp_replace(coalesce(o.customer ->> 'phone', ''), '\D', '', 'g') = v_phone
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.create_guest_order(jsonb, jsonb, text) from public;
revoke all on function public.lookup_guest_orders(text, text) from public;
grant execute on function public.create_guest_order(jsonb, jsonb, text) to anon, authenticated;
grant execute on function public.lookup_guest_orders(text, text) to anon, authenticated;

-- Normalised order line items.
create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.wallet_orders (id) on delete cascade,
  position integer not null,
  product_id text not null,
  kind text not null default 'wholesale',
  name text not null,
  size text,
  color text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) check (unit_price >= 0),
  unique (order_id, position)
);

-- Shipping / pickup details, one row per order.
create table if not exists public.order_shipping (
  order_id uuid primary key references public.wallet_orders (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  country text not null default '',
  state_region text not null default '',
  postal_code text not null default '',
  delivery_method text not null default '',
  is_pickup boolean not null default false,
  notes text not null default '',
  receipt_reference text
);

-- Status timeline shown to customers and admins.
create table if not exists public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.wallet_orders (id) on delete cascade,
  status text not null check (status in ('processing', 'shipped', 'completed', 'cancelled')),
  tracking_number text,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_status_history_order_idx on public.order_status_history (order_id, created_at);
create index if not exists wallet_orders_customer_email_idx on public.wallet_orders (lower(customer ->> 'email'));

alter table public.order_items enable row level security;
alter table public.order_shipping enable row level security;
alter table public.order_status_history enable row level security;

drop policy if exists "Owners read order items" on public.order_items;
create policy "Owners read order items" on public.order_items for select to authenticated
  using (exists (select 1 from public.wallet_orders o where o.id = order_id and o.user_id = (select auth.uid())));
drop policy if exists "Admins read order items" on public.order_items;
create policy "Admins read order items" on public.order_items for select to authenticated
  using (public.is_store_admin());

drop policy if exists "Owners read order shipping" on public.order_shipping;
create policy "Owners read order shipping" on public.order_shipping for select to authenticated
  using (exists (select 1 from public.wallet_orders o where o.id = order_id and o.user_id = (select auth.uid())));
drop policy if exists "Admins read order shipping" on public.order_shipping;
create policy "Admins read order shipping" on public.order_shipping for select to authenticated
  using (public.is_store_admin());

drop policy if exists "Owners read order history" on public.order_status_history;
create policy "Owners read order history" on public.order_status_history for select to authenticated
  using (exists (select 1 from public.wallet_orders o where o.id = order_id and o.user_id = (select auth.uid())));
drop policy if exists "Admins read order history" on public.order_status_history;
create policy "Admins read order history" on public.order_status_history for select to authenticated
  using (public.is_store_admin());

-- Guests have no direct table access; they use lookup_guest_orders().

create or replace function public.sync_order_details(p_order public.wallet_orders)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.order_items (order_id, position, product_id, kind, name, size, color, quantity, unit_price)
  select
    p_order.id,
    i.ord::integer,
    left(coalesce(i.item ->> 'id', ''), 100),
    left(coalesce(i.item ->> 'kind', 'wholesale'), 30),
    left(coalesce(i.item ->> 'name', 'Item'), 200),
    btrim((regexp_match(i.item ->> 'name', 'Size: (.+?)(?: - Color:|$)'))[1]),
    btrim((regexp_match(i.item ->> 'name', 'Color: (.+)$'))[1]),
    1,
    nullif(i.item ->> 'unit_price', '')::numeric
  from jsonb_array_elements(case when jsonb_typeof(p_order.items) = 'array' then p_order.items else '[]'::jsonb end)
    with ordinality as i(item, ord)
  on conflict (order_id, position) do nothing;

  insert into public.order_shipping (order_id, full_name, email, phone, address, country, state_region, postal_code, delivery_method, is_pickup, notes, receipt_reference)
  values (
    p_order.id,
    coalesce(p_order.customer ->> 'full_name', ''),
    coalesce(p_order.customer ->> 'email', ''),
    coalesce(p_order.customer ->> 'phone', ''),
    coalesce(p_order.customer ->> 'address', ''),
    coalesce(p_order.customer ->> 'country', ''),
    coalesce(p_order.customer ->> 'state_region', ''),
    coalesce(p_order.customer ->> 'postal_code', ''),
    coalesce(p_order.customer ->> 'delivery_method', ''),
    coalesce(p_order.customer ->> 'delivery_method', '') like 'In-store pickup%',
    coalesce(p_order.customer ->> 'device_model', ''),
    nullif(p_order.customer ->> 'receipt_reference', '')
  )
  on conflict (order_id) do nothing;
end;
$$;

create or replace function public.wallet_orders_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_order_details(new);
  insert into public.order_status_history (order_id, status, tracking_number, changed_by)
  values (new.id, public.order_display_status(new.tracking_number, new.fulfillment_status), new.tracking_number, auth.uid());
  return new;
end;
$$;

create or replace function public.wallet_orders_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text := public.order_display_status(old.tracking_number, old.fulfillment_status);
  v_new text := public.order_display_status(new.tracking_number, new.fulfillment_status);
begin
  if v_new is distinct from v_old then
    insert into public.order_status_history (order_id, status, tracking_number, changed_by)
    values (new.id, v_new, new.tracking_number, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists wallet_orders_sync_details on public.wallet_orders;
create trigger wallet_orders_sync_details
after insert on public.wallet_orders
for each row execute function public.wallet_orders_after_insert();

drop trigger if exists wallet_orders_status_history on public.wallet_orders;
create trigger wallet_orders_status_history
after update of tracking_number, fulfillment_status on public.wallet_orders
for each row execute function public.wallet_orders_after_update();

-- Backfill existing orders.
do $$
declare
  v_order public.wallet_orders;
begin
  for v_order in select * from public.wallet_orders loop
    perform public.sync_order_details(v_order);
    insert into public.order_status_history (order_id, status, tracking_number)
    select v_order.id, public.order_display_status(v_order.tracking_number, v_order.fulfillment_status), v_order.tracking_number
    where not exists (select 1 from public.order_status_history h where h.order_id = v_order.id);
  end loop;
end;
$$;

revoke all on function public.sync_order_details(public.wallet_orders) from public, anon, authenticated;
