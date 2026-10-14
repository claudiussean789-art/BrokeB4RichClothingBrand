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
