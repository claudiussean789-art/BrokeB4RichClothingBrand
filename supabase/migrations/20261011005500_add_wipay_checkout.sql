alter table public.wallet_orders
  drop constraint if exists wallet_orders_payment_method_check;

alter table public.wallet_orders
  add constraint wallet_orders_payment_method_check
  check (payment_method in ('wallet', 'paypal', 'manual', 'local', 'payoneer', 'wipay'));

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
  if p_payment_method not in ('paypal', 'manual', 'local', 'payoneer', 'wipay') then raise exception 'Unsupported order payment method.'; end if;

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
