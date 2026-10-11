alter table public.wallet_orders
  add column if not exists crypto_txid text;

alter table public.wallet_orders
  drop constraint if exists wallet_orders_status_check;

alter table public.wallet_orders
  add constraint wallet_orders_status_check
  check (status in ('paid', 'requested', 'pending', 'pending_verification', 'cancelled'));

alter table public.wallet_orders
  drop constraint if exists wallet_orders_payment_method_check;

alter table public.wallet_orders
  add constraint wallet_orders_payment_method_check
  check (payment_method in ('wallet', 'paypal', 'manual', 'local', 'payoneer', 'wipay', 'crypto'));

create or replace function public.set_wallet_order_paid_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    new.paid_at := coalesce(new.paid_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists wallet_order_set_paid_at on public.wallet_orders;
create trigger wallet_order_set_paid_at
before update of status on public.wallet_orders
for each row execute function public.set_wallet_order_paid_at();

create unique index if not exists wallet_orders_crypto_txid_unique
  on public.wallet_orders (crypto_txid)
  where crypto_txid is not null;

create or replace function public.submit_crypto_order(
  p_items jsonb,
  p_customer jsonb,
  p_txid text
)
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
  v_txid text := btrim(p_txid);
begin
  if v_user_id is null then raise exception 'Sign in to submit a crypto payment for verification.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty.'; end if;
  if jsonb_typeof(p_customer) <> 'object' then raise exception 'Customer information is required.'; end if;
  if v_txid is null or length(v_txid) < 6 or length(v_txid) > 200 then
    raise exception 'Enter a valid transaction ID or Binance Pay ID (6–200 characters).';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if v_item ->> 'kind' not in ('devices', 'repairs', 'wholesale', 'credits') then
      raise exception 'This item is not available for crypto checkout.';
    end if;
    select * into v_catalog from public.wallet_catalog_prices
    where id = v_item ->> 'id' and kind = v_item ->> 'kind' and active;
    if not found then
      raise exception 'Every item needs a confirmed server price before crypto payment can be submitted.';
    end if;
    v_total := v_total + v_catalog.price;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', v_catalog.id,
      'kind', v_catalog.kind,
      'name', v_catalog.name,
      'unit_price', v_catalog.price,
      'identifier', nullif(btrim(v_item ->> 'identifier'), '')
    ));
  end loop;

  insert into public.wallet_orders (
    user_id, items, customer, total, payment_method, status, payment_reference, crypto_txid
  )
  values (
    v_user_id, v_items, p_customer, v_total, 'crypto', 'pending_verification', 'crypto:' || v_txid, v_txid
  )
  returning * into v_order;
  return v_order;
end;
$$;

revoke all on function public.submit_crypto_order(jsonb, jsonb, text) from public, anon;
grant execute on function public.submit_crypto_order(jsonb, jsonb, text) to authenticated;
