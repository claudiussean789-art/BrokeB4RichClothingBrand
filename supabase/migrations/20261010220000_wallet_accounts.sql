create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  credit_balance numeric(12, 2) not null default 0 check (credit_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_catalog_prices (
  id text primary key,
  kind text not null check (kind in ('devices', 'repairs')),
  name text not null,
  price numeric(12, 2) not null check (price >= 0),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 1 and amount <= 10000),
  currency text not null default 'USD' check (currency = 'USD'),
  method text not null check (method in ('paypal', 'manual')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  paypal_order_id text unique,
  payment_reference text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.wallet_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  items jsonb not null,
  customer jsonb not null,
  total numeric(12, 2),
  currency text not null default 'USD' check (currency = 'USD'),
  payment_method text not null check (payment_method in ('wallet', 'paypal', 'manual', 'local', 'payoneer')),
  status text not null check (status in ('paid', 'requested')),
  created_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null check (amount <> 0),
  kind text not null check (kind in ('deposit', 'spend')),
  description text not null,
  topup_id uuid references public.wallet_topups (id),
  order_id uuid references public.wallet_orders (id),
  created_at timestamptz not null default now(),
  constraint wallet_transactions_single_reference check (
    (kind = 'deposit' and topup_id is not null and order_id is null and amount > 0)
    or (kind = 'spend' and order_id is not null and topup_id is null and amount < 0)
  )
);

create unique index if not exists wallet_transactions_topup_once
  on public.wallet_transactions (topup_id) where topup_id is not null;
create unique index if not exists wallet_transactions_order_once
  on public.wallet_transactions (order_id) where order_id is not null;
create index if not exists wallet_transactions_user_created
  on public.wallet_transactions (user_id, created_at desc);
create index if not exists wallet_orders_user_created
  on public.wallet_orders (user_id, created_at desc);
create index if not exists wallet_topups_user_created
  on public.wallet_topups (user_id, created_at desc);

insert into public.wallet_catalog_prices (id, kind, name, price) values
  ('ip-se-2', 'devices', 'iPhone SE 2', 30),
  ('ip-xs', 'devices', 'iPhone XS', 35),
  ('ip-xs-max', 'devices', 'iPhone XS Max', 40),
  ('ip-xr', 'devices', 'iPhone XR', 35),
  ('ip-13', 'devices', 'iPhone 13 - Grade A', 480),
  ('ip-14-pro', 'devices', 'iPhone 14 Pro', 650),
  ('ipad-mini-5', 'devices', 'iPad mini (5th Generation)', 30),
  ('ipad-air-3', 'devices', 'iPad Air (3rd Gen)', 38),
  ('ipad-8', 'devices', 'iPad (8th Generation)', 100),
  ('ipad-9', 'devices', 'iPad (9th Generation)', 100),
  ('ipad-standard', 'devices', 'iPad', 100),
  ('ipad-mini-6', 'devices', 'iPad mini (6th Generation)', 100),
  ('ipad-mini-7', 'devices', 'iPad mini (7th Generation)', 100),
  ('ipad-air-11', 'devices', 'iPad Air 11-inch', 100),
  ('ipad-air-13', 'devices', 'iPad Air 13-inch', 100),
  ('ipad-pro-11', 'devices', 'iPad Pro 11-inch', 100),
  ('ipad-pro-13', 'devices', 'iPad Pro 13-inch', 100),
  ('sam-s22', 'devices', 'Galaxy S22 Ultra', 550),
  ('jdm-a02', 'devices', 'Galaxy A02', 40),
  ('jdm-a02s', 'devices', 'Galaxy A02s', 40),
  ('jdm-a03-core', 'devices', 'Galaxy A03 Core', 40),
  ('jdm-a03', 'devices', 'Galaxy A03', 40),
  ('jdm-a03s', 'devices', 'Galaxy A03s', 40),
  ('jdm-a04e', 'devices', 'Galaxy A04e', 40),
  ('jdm-a04', 'devices', 'Galaxy A04', 40),
  ('jdm-a04s', 'devices', 'Galaxy A04s', 40),
  ('jdm-a05', 'devices', 'Galaxy A05', 40),
  ('jdm-a05s', 'devices', 'Galaxy A05s', 40),
  ('jdm-a06', 'devices', 'Galaxy A06', 40),
  ('jdm-a06-5g', 'devices', 'Galaxy A06 5G', 40),
  ('jdm-a07', 'devices', 'Galaxy A07', 40),
  ('jdm-a07-5g', 'devices', 'Galaxy A07 5G', 40),
  ('jdm-a10', 'devices', 'Galaxy A10', 40),
  ('jdm-a10s', 'devices', 'Galaxy A10s', 40),
  ('jdm-a11', 'devices', 'Galaxy A11', 40),
  ('jdm-a12', 'devices', 'Galaxy A12', 40),
  ('jdm-a12-nacho', 'devices', 'Galaxy A12 Nacho', 40),
  ('jdm-a13-4g', 'devices', 'Galaxy A13 4G', 40),
  ('jdm-a13-5g', 'devices', 'Galaxy A13 5G', 40),
  ('jdm-a14-4g', 'devices', 'Galaxy A14 4G', 40),
  ('jdm-a14-5g', 'devices', 'Galaxy A14 5G', 40),
  ('jdm-a15-4g', 'devices', 'Galaxy A15 4G', 40),
  ('jdm-a15-5g', 'devices', 'Galaxy A15 5G', 40),
  ('jdm-a16-4g', 'devices', 'Galaxy A16 4G', 40),
  ('jdm-a16-5g', 'devices', 'Galaxy A16 5G', 40),
  ('jdm-a17-4g', 'devices', 'Galaxy A17 4G', 40),
  ('jdm-a17-5g', 'devices', 'Galaxy A17 5G', 40),
  ('jdm-a20s', 'devices', 'Galaxy A20s', 40),
  ('jdm-a21s', 'devices', 'Galaxy A21s', 40),
  ('jdm-a22-4g', 'devices', 'Galaxy A22 4G', 40),
  ('jdm-a22-5g', 'devices', 'Galaxy A22 5G', 40),
  ('jdm-a23-4g', 'devices', 'Galaxy A23 4G', 40),
  ('jdm-a23-5g', 'devices', 'Galaxy A23 5G', 40),
  ('jdm-a24', 'devices', 'Galaxy A24', 40),
  ('jdm-a25', 'devices', 'Galaxy A25', 40),
  ('jdm-a30s', 'devices', 'Galaxy A30s', 40),
  ('jdm-a31', 'devices', 'Galaxy A31', 40),
  ('jdm-a32-4g', 'devices', 'Galaxy A32 4G', 40),
  ('jdm-a32-5g', 'devices', 'Galaxy A32 5G', 40),
  ('jdm-a33-5g', 'devices', 'Galaxy A33 5G', 40),
  ('jdm-a34-5g', 'devices', 'Galaxy A34 5G', 40),
  ('jdm-a35-5g', 'devices', 'Galaxy A35 5G', 40),
  ('jdm-a36-5g', 'devices', 'Galaxy A36 5G', 40),
  ('jdm-a50', 'devices', 'Galaxy A50', 40),
  ('jdm-a51', 'devices', 'Galaxy A51', 40),
  ('jdm-a52', 'devices', 'Galaxy A52', 40),
  ('jdm-a53-5g', 'devices', 'Galaxy A53 5G', 40),
  ('jdm-a54-5g', 'devices', 'Galaxy A54 5G', 40),
  ('tec-camon-20', 'devices', 'Tecno Camon 20 Pro', 220),
  ('tec-spark-10', 'devices', 'Tecno Spark 10 Pro', 160),
  ('xiaomi-redmi-12', 'devices', 'Xiaomi Redmi Note 12', 190),
  ('xiaomi-13-pro', 'devices', 'Xiaomi 13 Pro', 580),
  ('screen', 'repairs', 'Screen Replacement', 40),
  ('board', 'repairs', 'Board Repair / Micro-soldering', 65),
  ('software', 'repairs', 'Software Flash', 25),
  ('galaxy-a54-frp', 'repairs', 'Galaxy A54 5G FRP Service', 35),
  ('samsung-frp-other', 'repairs', 'Samsung Galaxy FRP Service (Other Models)', 35),
  ('port', 'repairs', 'Charging Port', 30),
  ('battery', 'repairs', 'Battery Replacement', 35)
on conflict (id) do update set kind = excluded.kind, name = excluded.name, price = excluded.price, active = true, updated_at = now();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, ''), updated_at = now() where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row when (old.email is distinct from new.email)
execute procedure public.sync_profile_email();

create or replace function public.request_wallet_topup(p_amount numeric, p_method text)
returns public.wallet_topups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_topup public.wallet_topups;
begin
  if v_user_id is null then raise exception 'Sign in to add wallet credit.'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 10000 or p_amount <> round(p_amount, 2) then
    raise exception 'Enter an amount from $1.00 to $10,000.00.';
  end if;
  if p_method not in ('paypal', 'manual') then raise exception 'Unsupported top-up payment method.'; end if;
  insert into public.wallet_topups (user_id, amount, method)
  values (v_user_id, p_amount, p_method)
  returning * into v_topup;
  return v_topup;
end;
$$;

create or replace function public.create_wallet_order(p_items jsonb, p_customer jsonb)
returns public.wallet_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_catalog public.wallet_catalog_prices;
  v_total numeric(12, 2) := 0;
  v_items jsonb := '[]'::jsonb;
  v_order public.wallet_orders;
  v_balance numeric(12, 2);
begin
  if v_user_id is null then raise exception 'Sign in to pay with wallet credit.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty.'; end if;
  if jsonb_typeof(p_customer) <> 'object' then raise exception 'Customer information is required.'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if v_item ->> 'kind' not in ('devices', 'repairs') then
      raise exception 'Server credit items need a confirmed price before wallet checkout.';
    end if;
    select * into v_catalog from public.wallet_catalog_prices
    where id = v_item ->> 'id' and kind = v_item ->> 'kind' and active for share;
    if not found then raise exception 'An item has no confirmed wallet price. Remove it or contact support.'; end if;
    v_total := v_total + v_catalog.price;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', v_catalog.id, 'kind', v_catalog.kind, 'name', v_catalog.name,
      'unit_price', v_catalog.price, 'identifier', nullif(btrim(v_item ->> 'identifier'), '')
    ));
  end loop;

  select credit_balance into v_balance from public.profiles where id = v_user_id for update;
  if not found then raise exception 'Wallet profile not found.'; end if;
  if v_balance < v_total then raise exception 'INSUFFICIENT_CREDIT: Add wallet credit before placing this order.'; end if;

  update public.profiles set credit_balance = credit_balance - v_total, updated_at = now() where id = v_user_id;
  insert into public.wallet_orders (user_id, items, customer, total, payment_method, status)
  values (v_user_id, v_items, p_customer, v_total, 'wallet', 'paid') returning * into v_order;
  insert into public.wallet_transactions (user_id, amount, kind, description, order_id)
  values (v_user_id, -v_total, 'spend', 'Wallet payment for order ' || left(v_order.id::text, 8), v_order.id);
  return v_order;
end;
$$;

create or replace function public.create_order_request(p_items jsonb, p_customer jsonb, p_payment_method text)
returns public.wallet_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_catalog public.wallet_catalog_prices;
  v_total numeric(12, 2) := 0;
  v_total_known boolean := true;
  v_items jsonb := '[]'::jsonb;
  v_order public.wallet_orders;
begin
  if v_user_id is null then raise exception 'Sign in to save an order.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty.'; end if;
  if jsonb_typeof(p_customer) <> 'object' then raise exception 'Customer information is required.'; end if;
  if p_payment_method not in ('paypal', 'manual', 'local', 'payoneer') then raise exception 'Unsupported order payment method.'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_catalog from public.wallet_catalog_prices
    where id = v_item ->> 'id' and kind = v_item ->> 'kind' and active;
    if found then
      v_total := v_total + v_catalog.price;
      v_items := v_items || jsonb_build_array(jsonb_build_object('id', v_catalog.id, 'kind', v_catalog.kind, 'name', v_catalog.name, 'unit_price', v_catalog.price, 'identifier', nullif(btrim(v_item ->> 'identifier'), '')));
    else
      v_total_known := false;
      v_items := v_items || jsonb_build_array(jsonb_build_object('id', v_item ->> 'id', 'kind', v_item ->> 'kind', 'name', left(coalesce(v_item ->> 'name', 'Service item'), 200), 'unit_price', null, 'identifier', nullif(btrim(v_item ->> 'identifier'), '')));
    end if;
  end loop;

  insert into public.wallet_orders (user_id, items, customer, total, payment_method, status)
  values (v_user_id, v_items, p_customer, case when v_total_known then v_total else null end, p_payment_method, 'requested')
  returning * into v_order;
  return v_order;
end;
$$;

create or replace function public.complete_wallet_topup(p_topup_id uuid, p_payment_reference text)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topup public.wallet_topups;
  v_balance numeric(12, 2);
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if v_role <> 'service_role' then raise exception 'Only the verified payment service can complete a top-up.'; end if;
  if p_payment_reference is null or length(btrim(p_payment_reference)) < 3 then raise exception 'A verified payment reference is required.'; end if;
  select * into v_topup from public.wallet_topups where id = p_topup_id for update;
  if not found then raise exception 'Wallet top-up was not found.'; end if;
  if v_topup.status = 'completed' then
    if v_topup.payment_reference <> p_payment_reference then raise exception 'Top-up was already completed with another reference.'; end if;
    select credit_balance into v_balance from public.profiles where id = v_topup.user_id;
    return v_balance;
  end if;
  if v_topup.status <> 'pending' then raise exception 'Wallet top-up is not pending.'; end if;

  update public.profiles set credit_balance = credit_balance + v_topup.amount, updated_at = now()
  where id = v_topup.user_id returning credit_balance into v_balance;
  if not found then raise exception 'Wallet profile not found.'; end if;
  update public.wallet_topups set status = 'completed', payment_reference = btrim(p_payment_reference), completed_at = now()
  where id = v_topup.id;
  insert into public.wallet_transactions (user_id, amount, kind, description, topup_id)
  values (v_topup.user_id, v_topup.amount, 'deposit', 'Wallet top-up via ' || upper(v_topup.method), v_topup.id);
  return v_balance;
end;
$$;

alter table public.profiles enable row level security;
alter table public.wallet_catalog_prices enable row level security;
alter table public.wallet_topups enable row level security;
alter table public.wallet_orders enable row level security;
alter table public.wallet_transactions enable row level security;

create policy "Users can read their own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Users can update their own name" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Catalog prices are readable" on public.wallet_catalog_prices for select to authenticated using (active);
create policy "Users can read their own top-ups" on public.wallet_topups for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can read their own orders" on public.wallet_orders for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can read their own transactions" on public.wallet_transactions for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.profiles, public.wallet_catalog_prices, public.wallet_topups, public.wallet_orders, public.wallet_transactions from anon, authenticated;
grant select on public.profiles, public.wallet_catalog_prices, public.wallet_topups, public.wallet_orders, public.wallet_transactions to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant usage on schema public to authenticated;
revoke all on function public.request_wallet_topup(numeric, text) from public, anon;
revoke all on function public.create_wallet_order(jsonb, jsonb) from public, anon;
revoke all on function public.create_order_request(jsonb, jsonb, text) from public, anon;
revoke all on function public.complete_wallet_topup(uuid, text) from public, anon, authenticated;
grant execute on function public.request_wallet_topup(numeric, text) to authenticated;
grant execute on function public.create_wallet_order(jsonb, jsonb) to authenticated;
grant execute on function public.create_order_request(jsonb, jsonb, text) to authenticated;
grant execute on function public.complete_wallet_topup(uuid, text) to service_role;