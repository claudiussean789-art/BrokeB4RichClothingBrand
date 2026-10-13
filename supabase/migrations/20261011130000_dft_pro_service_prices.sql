insert into public.wallet_catalog_prices (id, kind, name, price) values
  ('dft-3-months', 'credits', 'DFT Pro - 3 Months Activation (90 Days)', 18.00),
  ('dft-6-months', 'credits', 'DFT Pro - 6 Months Activation (180 Days)', 27.00),
  ('dft-12-months', 'credits', 'DFT Pro - 12 Months Activation (360 Days)', 45.00),
  ('dft-rent-6-hours', 'credits', 'DFT Pro - Rent (6 Hours)', 1.20)
on conflict (id) do update
set kind = excluded.kind,
    name = excluded.name,
    price = excluded.price,
    active = true;
