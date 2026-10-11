alter table public.wallet_catalog_prices
  drop constraint if exists wallet_catalog_prices_kind_check;

alter table public.wallet_catalog_prices
  add constraint wallet_catalog_prices_kind_check
  check (kind in ('devices', 'repairs', 'wholesale', 'credits'));

insert into public.wallet_catalog_prices (id, kind, name, price) values
  ('eft-1-month', 'credits', 'EFT Tool - 1 Month Activation (30 Days)', 20.00),
  ('eft-3-months', 'credits', 'EFT Tool - 3 Months Activation (90 Days)', 18.00),
  ('eft-6-months', 'credits', 'EFT Tool - 6 Months Activation (180 Days)', 27.00),
  ('eft-12-months', 'credits', 'EFT Tool - 12 Months Activation (360 Days)', 45.00),
  ('unlock-3-months', 'credits', 'Unlock Tool - 3 Months Activation (90 Days)', 18.00),
  ('unlock-6-months', 'credits', 'Unlock Tool - 6 Months Activation (180 Days)', 27.00),
  ('unlock-12-months', 'credits', 'Unlock Tool - 12 Months Activation (360 Days)', 45.00),
  ('unlock-rent-6-hours', 'credits', 'Unlock Tool - Rent (6 Hours)', 1.20)
on conflict (id) do update
set kind = excluded.kind,
    name = excluded.name,
    price = excluded.price,
    active = true;

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
    if v_item ->> 'kind' not in ('devices', 'repairs', 'wholesale', 'credits') then
      raise exception 'This item cannot be paid for with wallet credit.';
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

revoke all on function public.create_wallet_order(jsonb, jsonb) from public, anon;
grant execute on function public.create_wallet_order(jsonb, jsonb) to authenticated;
