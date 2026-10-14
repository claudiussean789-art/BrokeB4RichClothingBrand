insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'checkout-payment-receipts',
  'checkout-payment-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Customers can upload checkout payment receipts"
on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'checkout-payment-receipts'
  and name ~ '^checkout/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$'
);
