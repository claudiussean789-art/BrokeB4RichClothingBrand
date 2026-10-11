# Supabase accounts and wallet setup

## 1. Configure the app

1. Create or open a Supabase project.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable/anon key only). Never put a service-role key or PayPal secret in a `VITE_` variable.
3. In Supabase Authentication, configure the allowed site and redirect URLs for the deployed site and local development. Enable email/password sign-in; if email confirmation is enabled, users must confirm before the first sign-in.

Customer registration collects full name, a unique username, telephone number, address, email, and password. Customers sign in with their email and password; the username is stored on their profile.

## 2. Apply the database migration

Install the Supabase CLI if needed, authenticate, link the project, then run:

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migrations create `profiles`, `wallet_catalog_prices`, `wallet_topups`, `wallet_orders`, and `wallet_transactions`; create the auth profile trigger and wallet RPCs; and seed the currently priced device and repair catalog. The customer registration migration adds username, telephone, and address fields to profiles. The PayPal order migration also adds prices for the wholesale catalog services. The Google Pixel services migration adds server-side prices for Pixel carrier unlock and tool-credit offers. The wallet service checkout migration adds server-side pricing for EFT Tool and Unlock Tool packages and enables wallet checkout for priced wholesale and server-credit items. The crypto order migration adds USDT / Binance Pay transaction references and the `pending_verification` state; crypto orders are accepted only when every item has an active server-side price. The Pixel information check is request-only because its listed $0.0324 price is below the app's cent-level checkout precision. The manual receipt migration creates a private receipt bucket and only allows signed-in customers to upload to their own folder. Balance changes are only possible through database functions. Row-level security prevents users from reading another account's records.

Review `wallet_catalog_prices` whenever the app's prices change. The database price is authoritative for wallet and PayPal order payments; editing a frontend price alone does not change the amount charged.

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
  MANUAL_PAYMENT_ADMIN_TOKEN=GENERATE_A_LONG_RANDOM_ADMIN_ONLY_TOKEN `
  RESEND_API_KEY=YOUR_RESEND_API_KEY `
  PAYMENT_RECEIPT_FROM_EMAIL="Exclusive Mobile Solutions <receipts@YOUR_VERIFIED_DOMAIN>"
```

For production PayPal, set `PAYPAL_API_BASE=https://api-m.paypal.com`. Never expose these values in the frontend or commit them. Deploy:

```powershell
supabase functions deploy create-paypal-order --project-ref YOUR_PROJECT_REF
supabase functions deploy capture-paypal-topup --project-ref YOUR_PROJECT_REF
supabase functions deploy create-paypal-order-checkout --project-ref YOUR_PROJECT_REF
supabase functions deploy capture-paypal-order-checkout --project-ref YOUR_PROJECT_REF
supabase functions deploy confirm-manual-topup --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

The wallet top-up PayPal functions create a checkout using the pending top-up amount from the database and verify the completed capture before crediting the wallet. The order checkout functions require a signed-in customer, use the server-priced order total, redirect the customer to PayPal to sign in or create an account, and mark the order paid only after verifying the capture, order reference, amount, and currency. Priced wholesale services are included; other orders with unconfirmed prices cannot be paid through PayPal until their prices are added to `wallet_catalog_prices`.

For NCB transfers, customers submit the bank reference and a JPG, PNG, WEBP, or PDF receipt (maximum 5 MB). Their request stays pending and no credit is issued until support independently verifies the funds. Review the matching `wallet_topups` row and its `receipt_path` in Supabase; open that object in the private `wallet-payment-receipts` bucket. Then confirm using the private `MANUAL_PAYMENT_ADMIN_TOKEN` from a trusted admin tool. Set up a Resend account, verify the sender domain, and configure both email secrets above so confirmation sends a wallet-credit receipt to the customer's account email. If email delivery is temporarily unavailable, the transfer remains credited and the confirmation response reports the email issue; retry confirmation with the same payment reference after resolving it. The 5–15 minute review time is an operational target, not a guarantee.

The manual confirmation function requires the private `MANUAL_PAYMENT_ADMIN_TOKEN`; call it only from a trusted admin tool after independently verifying the transfer:

```powershell
$headers = @{ 'x-manual-payment-admin-token' = $env:MANUAL_PAYMENT_ADMIN_TOKEN; 'apikey' = $env:SUPABASE_ANON_KEY; 'Authorization' = "Bearer $($env:SUPABASE_ANON_KEY)" }
$body = @{ topupId = 'PENDING_TOPUP_UUID'; paymentReference = 'VERIFIED_TRANSFER_REFERENCE' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/confirm-manual-topup' -Headers $headers -ContentType 'application/json' -Body $body
```

Do not share the admin token with customers or put it in browser code. A manual transfer remains pending until an administrator verifies it and confirms it through this function.

## Wallet checkout limits

Wallet purchases are checked and charged atomically on the server against `wallet_catalog_prices`; client-submitted totals are ignored. Devices, repairs, wholesale services, and server-credit packages can be paid from the wallet when they have an active matching server price. Items whose price is not set in the database cannot be purchased with wallet credit. Box/Dongle credit amounts without confirmed prices remain request-only until prices are agreed and added to the catalog table. The same applies to any contact-for-price item.

PayPal wallet top-ups and priced catalog orders use PayPal checkout. Crypto is available for priced orders and remains pending until an administrator verifies the transaction. Local, Payoneer, WiPay, and any unpriced product/service requests continue through the order request flow unless separately configured for payment.

## Crypto checkout and manual verification

Edit `src/data/cryptoPayment.ts` to set the public USDT TRC20 receiving address, Binance Pay ID, and a QR image path under `public/`. The file currently contains placeholders, so replace them before accepting crypto transfers. Customers must sign in, submit a transaction ID, and have a confirmed price for every selected item. The `submit_crypto_order` RPC saves the server-priced order as `pending_verification`; a submitted TXID is only a customer claim and does not verify payment or add wallet credit.

Review `wallet_orders` in the Supabase dashboard for `payment_method = crypto` and `status = pending_verification`. Independently verify the transaction in Binance Pay or on the correct chain before changing the row's status to `paid`. Only project administrators should make this change. No Telegram bot notification or payment-verification integration is configured.