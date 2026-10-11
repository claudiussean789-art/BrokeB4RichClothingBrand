insert into public.wallet_catalog_prices (id, kind, name, price) values
  ('google-pixel-carrier-unlock-tool', 'wholesale', 'Google Pixel Carrier Unlock Windows Tool', 18.90),
  ('pixel-service-tool-refill-credits', 'wholesale', 'Pixel Service Tool - Refill Credits', 0.55),
  ('gpixel-pro-credits-new-user', 'wholesale', 'GPixel Pro Credits - New User', 0.90),
  ('gpixel-pro-credits-existing-user', 'wholesale', 'GPixel Pro Credits - Existing User', 0.90)
on conflict (id) do update
set kind = excluded.kind,
    name = excluded.name,
    price = excluded.price,
    active = true;
