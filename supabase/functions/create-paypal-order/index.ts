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
    if (typeof body.topupId !== 'string') return json({ error: 'Top-up ID is required.' }, 400);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: topup, error: topupError } = await admin.from('wallet_topups')
      .select('id,user_id,amount,currency,method,status')
      .eq('id', body.topupId).eq('user_id', user.id).maybeSingle();
    if (topupError) throw topupError;
    if (!topup || topup.method !== 'paypal' || topup.status !== 'pending') {
      return json({ error: 'Pending PayPal top-up was not found.' }, 404);
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
    const origin = Deno.env.get('APP_ORIGIN');
    if (!origin) return json({ error: 'Application return URL is not configured.' }, 500);
    const returnUrl = new URL('/', origin);
    returnUrl.searchParams.set('wallet_topup', topup.id);
    const cancelUrl = new URL('/', origin);
    cancelUrl.searchParams.set('wallet_topup_cancelled', '1');
    const orderResponse = await fetch(`${paypalApi}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `topup-${topup.id}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: topup.id,
          custom_id: topup.id,
          invoice_id: topup.id,
          amount: { currency_code: topup.currency, value: Number(topup.amount).toFixed(2) },
          description: 'Exclusive Mobile Solutions wallet credit',
        }],
        application_context: {
          return_url: returnUrl.toString(),
          cancel_url: cancelUrl.toString(),
          user_action: 'PAY_NOW',
        },
      }),
    });
    if (!orderResponse.ok) throw new Error(`PayPal order creation failed (${orderResponse.status}).`);
    const order = await orderResponse.json();
    const approvalUrl = order.links?.find((link: { rel?: string }) => link.rel === 'approve')?.href;
    if (!order.id || !approvalUrl) throw new Error('PayPal did not return an approval URL.');
    const { error: updateError } = await admin.from('wallet_topups')
      .update({ paypal_order_id: order.id }).eq('id', topup.id).eq('status', 'pending');
    if (updateError) throw updateError;
    return json({ approvalUrl });
  } catch (error) {
    console.error('create-paypal-order failed:', error);
    return json({ error: 'Could not start PayPal checkout. Please retry or contact support.' }, 500);
  }
});