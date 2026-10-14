create table if not exists public.store_reviews (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(btrim(customer_name)) between 2 and 80),
  rating smallint not null check (rating between 1 and 5),
  review text not null check (char_length(btrim(review)) between 10 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists store_reviews_created_at
  on public.store_reviews (created_at desc);

alter table public.store_reviews enable row level security;

create policy "Anyone can read public store reviews"
  on public.store_reviews for select to anon, authenticated
  using (true);

create policy "Anyone can submit a store review"
  on public.store_reviews for insert to anon, authenticated
  with check (
    char_length(btrim(customer_name)) between 2 and 80
    and rating between 1 and 5
    and char_length(btrim(review)) between 10 and 1000
  );

revoke all on public.store_reviews from public, anon, authenticated;
grant select on public.store_reviews to anon, authenticated;
grant insert (customer_name, rating, review) on public.store_reviews to anon, authenticated;
