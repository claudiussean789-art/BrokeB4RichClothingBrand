alter table public.profiles
  add column if not exists is_admin boolean not null default false;

alter table public.wallet_orders
  add column if not exists fulfillment_status text not null default 'pending';

alter table public.wallet_orders
  drop constraint if exists wallet_orders_fulfillment_status_check;

alter table public.wallet_orders
  add constraint wallet_orders_fulfillment_status_check
  check (fulfillment_status in ('pending', 'in_progress', 'completed', 'failed'));

update public.wallet_orders
set fulfillment_status = case
  when status in ('paid', 'in_progress') then 'in_progress'
  when status in ('completed') then 'completed'
  when status in ('cancelled', 'failed') then 'failed'
  else 'pending'
end
where fulfillment_status = 'pending';

create or replace function public.admin_list_orders()
returns setof public.wallet_orders
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in required.';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Admin access required.';
  end if;
  return query
    select *
    from public.wallet_orders
    order by created_at desc;
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
  if auth.uid() is null then
    raise exception 'Sign in required.';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Admin access required.';
  end if;
  if p_status not in ('pending', 'in_progress', 'completed', 'failed') then
    raise exception 'Invalid status.';
  end if;

  update public.wallet_orders
  set fulfillment_status = p_status
  where id = p_order_id
  returning * into v_order;

  if not found then
    raise exception 'Order not found.';
  end if;

  return v_order;
end;
$$;

revoke all on function public.admin_list_orders() from public, anon;
revoke all on function public.admin_set_order_fulfillment_status(uuid, text) from public, anon;
grant execute on function public.admin_list_orders() to authenticated;
grant execute on function public.admin_set_order_fulfillment_status(uuid, text) to authenticated;
