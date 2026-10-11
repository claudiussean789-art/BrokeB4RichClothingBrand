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
    const origin = Deno.env.get('APP_ORIGIN');
    if (!url || !anonKey || !serviceKey || !paypalClientId || !paypalSecret || !paypalApi || !origin) {
      return json({ error: 'PayPal checkout is not configured.' }, 503);
    }

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Your session is invalid. Sign in again.' }, 401);

    const body = await request.json();
    if (typeof body.orderId !== 'string') return json({ error: 'Order ID is required.' }, 400);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: order, error: orderError } = await admin.from('wallet_orders')
      .select('id,user_id,total,currency,payment_method,status')
      .eq('id', body.orderId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.payment_method !== 'paypal') return json({ error: 'PayPal order request was not found.' }, 404);
    if (order.status !== 'requested' || order.total === null || Number(order.total) <= 0) {
      return json({ error: 'This order contains items without confirmed prices. Request a quote before paying with PayPal.' }, 409);
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

    const returnUrl = new URL('/', origin);
    returnUrl.searchParams.set('paypal_order', order.id);
    const cancelUrl = new URL('/', origin);
    cancelUrl.searchParams.set('paypal_order_cancelled', order.id);
    const paypalResponse = await fetch(`${paypalApi}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `order-${order.id}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: order.id,
          custom_id: order.id,
          invoice_id: order.id,
          amount: { currency_code: order.currency, value: Number(order.total).toFixed(2) },
          description: `Exclusive Mobile Solutions order ${order.id.slice(0, 8)}`,
        }],
        application_context: {
          return_url: returnUrl.toString(),
          cancel_url: cancelUrl.toString(),
          user_action: 'PAY_NOW',
        },
      }),
    });
    if (!paypalResponse.ok) throw new Error(`PayPal order creation failed (${paypalResponse.status}).`);
    const paypalOrder = await paypalResponse.json();
    const approvalUrl = paypalOrder.links?.find((link: { rel?: string }) => link.rel === 'approve')?.href;
    if (typeof paypalOrder.id !== 'string' || typeof approvalUrl !== 'string') {
      throw new Error('PayPal did not return an approval URL.');
    }

    const { data: updatedOrder, error: updateError } = await admin.from('wallet_orders')
      .update({ status: 'pending', paypal_order_id: paypalOrder.id })
      .eq('id', order.id)
      .eq('user_id', user.id)
      .eq('status', 'requested')
      .select('id')
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updatedOrder) return json({ error: 'The order is no longer available for PayPal checkout.' }, 409);
    return json({ approvalUrl });
  } catch (error) {
    console.error('create-paypal-order-checkout failed:', error);
    return json({ error: 'Could not start PayPal checkout. Please retry or contact support.' }, 500);
  }
});
