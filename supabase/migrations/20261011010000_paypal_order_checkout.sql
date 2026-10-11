alter table public.wallet_orders
  drop constraint if exists wallet_orders_status_check;

alter table public.wallet_orders
  add constraint wallet_orders_status_check
  check (status in ('paid', 'requested', 'pending', 'cancelled'));

alter table public.wallet_orders
  add column if not exists paypal_order_id text unique,
  add column if not exists payment_reference text,
  add column if not exists paid_at timestamptz;

alter table public.wallet_catalog_prices
  drop constraint if exists wallet_catalog_prices_kind_check;

alter table public.wallet_catalog_prices
  add constraint wallet_catalog_prices_kind_check
  check (kind in ('devices', 'repairs', 'wholesale'));

insert into public.wallet_catalog_prices (id, kind, name, price) values
  ('iphone-18-pro-max-unlock', 'wholesale', 'Apple iPhone 18 Pro Max - Official Factory Unlock', 34.99),
  ('iphone-18-pro-unlock', 'wholesale', 'Apple iPhone 18 Pro - Network & Carrier Unlock', 29.95),
  ('iphone-17-pro-max-unlock', 'wholesale', 'Apple iPhone 17 Pro Max - Premium Clean Unlock', 24.50),
  ('samsung-s26-ultra-unlock', 'wholesale', 'Samsung Galaxy S26 Ultra - Direct FRP & Network Unlock', 21),
  ('samsung-z-fold8-unlock', 'wholesale', 'Samsung Galaxy Z Fold8 & Z Fold8 Ultra Unlock', 38),
  ('iphone-duo-esim-unlock', 'wholesale', 'Apple iPhone Duo - Dual eSIM Unlock Service', 19.99),
  ('pixel-unbarring', 'wholesale', 'Google Pixel 8/9/10 Series - Direct Carrier Unbarring', 15),
  ('motorola-unlock-app', 'wholesale', 'Motorola Moto Edge / Razr - Code Unlock APP', 12.50),
  ('xiaomi-honor-unlock', 'wholesale', 'Xiaomi & Honor Account Removal & Network Unlock', 11),
  ('ipad-watch-fmi', 'wholesale', 'FMI OFF for iPad WiFi & iWatch GPS Removal', 28),
  ('att-nck-clean-pro', 'wholesale', 'USA AT&T NCK / Clean Pro iPhone & Samsung Unlock', 14.99),
  ('latin-america-carrier-unlock', 'wholesale', 'Mexico Nextel / Claro / Puerto Rico Carrier Service', 16.50)
on conflict (id) do update
set kind = excluded.kind, name = excluded.name, price = excluded.price, active = true;
