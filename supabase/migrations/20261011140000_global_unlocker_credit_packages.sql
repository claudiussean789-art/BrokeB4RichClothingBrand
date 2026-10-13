insert into public.wallet_catalog_prices (id, kind, name, price) values
  ('global-unlocker-10-credits', 'credits', 'Global Unlocker Pro - 10 Credits', 15.00),
  ('global-unlocker-25-credits', 'credits', 'Global Unlocker Pro - 25 Credits', 30.00),
  ('global-unlocker-50-credits', 'credits', 'Global Unlocker Pro - 50 Credits', 57.00),
  ('global-unlocker-100-credits', 'credits', 'Global Unlocker Pro - 100 Credits', 112.00)
on conflict (id) do update
set kind = excluded.kind,
    name = excluded.name,
    price = excluded.price,
    active = true;
