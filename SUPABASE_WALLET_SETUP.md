# Supabase accounts and wallet setup

## 1. Configure the app

1. Create or open a Supabase project.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable/anon key only). Never put a service-role key or PayPal secret in a `VITE_` variable.
3. In Supabase Authentication, configure the allowed site and redirect URLs for the deployed site and local development. Enable email/password sign-in; if email confirmation is enabled, users must confirm before the first sign-in.

## 2. Apply the database migration

Install the Supabase CLI if needed, authenticate, link the project, then run:

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migration creates `profiles`, `wallet_catalog_prices`, `wallet_topups`, `wallet_orders`, and `wallet_transactions`; creates the auth profile trigger and wallet RPCs; and seeds the currently priced device and repair catalog. Balance changes are only possible through database functions. Row-level security prevents users from reading another account's records.

Review `wallet_catalog_prices` whenever the app's prices change. The database price is authoritative for wallet payments; editing a frontend price alone does not change the amount charged.

## 3. Configure and deploy PayPal functions

Create PayPal REST app credentials for sandbox testing first. Set these Supabase Function secrets (use sandbox API base while testing and the live API base only after launch):

```powershell
supabase secrets set --project-ref YOUR_PROJECT_REF `
  SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY `
  SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY `
  PAYPAL_CLIENT_ID=YOUR_PAYPAL_CLIENT_ID `
  PAYPAL_CLIENT_SECRET=YOUR_PAYPAL_CLIENT_SECRET `
  PAYPAL_API_BASE=https://api-m.sandbox.paypal.com `
  APP_ORIGIN=https://YOUR_PUBLIC_SITE `
  MANUAL_PAYMENT_ADMIN_TOKEN=GENERATE_A_LONG_RANDOM_ADMIN_ONLY_TOKEN
```

For production PayPal, set `PAYPAL_API_BASE=https://api-m.paypal.com`. Never expose these values in the frontend or commit them. Deploy:

```powershell
supabase functions deploy create-paypal-order --project-ref YOUR_PROJECT_REF
supabase functions deploy capture-paypal-topup --project-ref YOUR_PROJECT_REF
supabase functions deploy confirm-manual-topup --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

The PayPal function creates an order using the pending top-up amount read from the database, then verifies the completed capture's order ID, top-up reference, amount, and currency before crediting the wallet. Credit and transaction creation occur atomically and are idempotent. The manual confirmation function requires the private `MANUAL_PAYMENT_ADMIN_TOKEN`; call it only from a trusted admin tool after independently verifying the transfer:

```powershell
$headers = @{ 'x-manual-payment-admin-token' = $env:MANUAL_PAYMENT_ADMIN_TOKEN; 'apikey' = $env:SUPABASE_ANON_KEY; 'Authorization' = "Bearer $($env:SUPABASE_ANON_KEY)" }
$body = @{ topupId = 'PENDING_TOPUP_UUID'; paymentReference = 'VERIFIED_TRANSFER_REFERENCE' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/confirm-manual-topup' -Headers $headers -ContentType 'application/json' -Body $body
```

Do not share the admin token with customers or put it in browser code. A manual transfer remains pending until an administrator verifies it and confirms it through this function.

## Wallet checkout limits

Wallet purchases are checked and charged atomically on the server against `wallet_catalog_prices`; client-submitted totals are ignored. Items whose price is not set in the database cannot be purchased with wallet credit. The Box/Dongle server-credit services currently have no confirmed prices, so they remain request-only and cannot be wallet-charged until prices are agreed and added to the catalog table. The same applies to any contact-for-price item.

PayPal/manual options currently top up the wallet; regular product/service orders still submit as order requests through the existing WhatsApp flow unless the customer selects wallet credit.