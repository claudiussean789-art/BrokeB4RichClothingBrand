alter table public.wallet_topups
  add column if not exists customer_payment_reference text,
  add column if not exists receipt_path text,
  add column if not exists receipt_email_sent_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wallet-payment-receipts',
  'wallet-payment-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Customers can upload their own wallet receipts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'wallet-payment-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 1
);

create or replace function public.submit_manual_topup_receipt(
  p_topup_id uuid,
  p_receipt_path text,
  p_payment_reference text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Sign in to submit a payment receipt.'; end if;
  if p_payment_reference is null or length(btrim(p_payment_reference)) < 3
    or length(btrim(p_payment_reference)) > 200 then
    raise exception 'Enter a valid bank transfer reference.';
  end if;
  if p_receipt_path is null or p_receipt_path !~ (
    '^' || v_user_id::text || '/' || p_topup_id::text || '\.(jpg|png|webp|pdf)$'
  ) then
    raise exception 'The payment receipt file is invalid.';
  end if;

  update public.wallet_topups
  set receipt_path = p_receipt_path,
      customer_payment_reference = btrim(p_payment_reference)
  where id = p_topup_id
    and user_id = v_user_id
    and method = 'manual'
    and status = 'pending'
    and receipt_path is null
    and exists (
      select 1 from storage.objects
      where bucket_id = 'wallet-payment-receipts'
        and name = p_receipt_path
    );
  if not found then raise exception 'The pending top-up or uploaded receipt could not be found.'; end if;
end;
$$;

revoke all on function public.submit_manual_topup_receipt(uuid, text, text) from public, anon;
grant execute on function public.submit_manual_topup_receipt(uuid, text, text) to authenticated;
