import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Authentication required.' }, 401);
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID');
    const paypalSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
    const paypalApi = Deno.env.get('PAYPAL_API_BASE');
    if (!url || !anonKey || !serviceKey || !paypalClientId || !paypalSecret || !paypalApi) {
      return json({ error: 'Payment service is not configured.' }, 503);
    }
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Your session is invalid. Sign in again.' }, 401);
    const body = await request.json();
    if (typeof body.topupId !== 'string' || typeof body.paypalOrderId !== 'string') {
      return json({ error: 'Top-up and PayPal order IDs are required.' }, 400);
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: topup, error: topupError } = await admin.from('wallet_topups')
      .select('id,user_id,amount,currency,method,status,paypal_order_id,payment_reference')
      .eq('id', body.topupId).eq('user_id', user.id).maybeSingle();
    if (topupError) throw topupError;
    if (!topup || topup.method !== 'paypal') return json({ error: 'PayPal top-up was not found.' }, 404);
    if (topup.status === 'completed') {
      const { data: profile, error: profileError } = await admin.from('profiles').select('credit_balance').eq('id', user.id).single();
      if (profileError) throw profileError;
      return json({ status: 'completed', balance: profile.credit_balance });
    }
    if (topup.status !== 'pending' || topup.paypal_order_id !== body.paypalOrderId) {
      return json({ error: 'PayPal order does not match this pending top-up.' }, 409);
    }

    const tokenResponse = await fetch(`${paypalApi}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${paypalClientId}:${paypalSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!tokenResponse.ok) throw new Error(`PayPal token request failed (${tokenResponse.status}).`);
    const tokenData = await tokenResponse.json();
    const captureResponse = await fetch(`${paypalApi}/v2/checkout/orders/${encodeURIComponent(body.paypalOrderId)}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `capture-${topup.id}`,
      },
      body: '{}',
    });
    if (!captureResponse.ok) throw new Error(`PayPal capture request failed (${captureResponse.status}).`);
    const captureResult = await captureResponse.json();
    const unit = captureResult.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    if (captureResult.status !== 'COMPLETED' || capture?.status !== 'COMPLETED'
      || unit?.custom_id !== topup.id
      || capture?.amount?.currency_code !== topup.currency
      || capture?.amount?.value !== Number(topup.amount).toFixed(2)
      || !capture?.id) {
      return json({ error: 'PayPal payment could not be verified. No wallet credit was added.' }, 409);
    }
    const { data: balance, error: creditError } = await admin.rpc('complete_wallet_topup', {
      p_topup_id: topup.id,
      p_payment_reference: `paypal:${capture.id}`,
    });
    if (creditError) throw creditError;
    return json({ status: 'completed', balance });
  } catch (error) {
    console.error('capture-paypal-topup failed:', error);
    return json({ error: 'Could not verify PayPal payment. No wallet credit was added.' }, 500);
  }
});