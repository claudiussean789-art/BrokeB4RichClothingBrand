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
      return json({ error: 'PayPal checkout is not configured.' }, 503);
    }

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Your session is invalid. Sign in again.' }, 401);

    const body = await request.json();
    if (typeof body.orderId !== 'string' || typeof body.paypalOrderId !== 'string') {
      return json({ error: 'Order ID and PayPal order ID are required.' }, 400);
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: order, error: orderError } = await admin.from('wallet_orders')
      .select('id,user_id,total,currency,payment_method,status,paypal_order_id,payment_reference')
      .eq('id', body.orderId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.payment_method !== 'paypal') return json({ error: 'PayPal order was not found.' }, 404);
    if (order.status === 'paid' && order.paypal_order_id === body.paypalOrderId) {
      return json({ status: 'completed', orderId: order.id });
    }
    if (order.status !== 'pending' || order.paypal_order_id !== body.paypalOrderId || order.total === null) {
      return json({ error: 'PayPal order does not match a pending order.' }, 409);
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
        'PayPal-Request-Id': `capture-order-${order.id}`,
      },
      body: '{}',
    });
    if (!captureResponse.ok) throw new Error(`PayPal capture request failed (${captureResponse.status}).`);
    const captureResult = await captureResponse.json();
    const unit = captureResult.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    const expectedAmount = Number(order.total).toFixed(2);
    if (captureResult.status !== 'COMPLETED'
      || unit?.reference_id !== order.id
      || unit?.custom_id !== order.id
      || capture?.status !== 'COMPLETED'
      || capture?.amount?.currency_code !== order.currency
      || capture?.amount?.value !== expectedAmount
      || typeof capture?.id !== 'string') {
      return json({ error: 'PayPal payment could not be verified. The order remains unpaid.' }, 409);
    }

    const paymentReference = `paypal:${capture.id}`;
    const { data: updatedOrder, error: updateError } = await admin.from('wallet_orders')
      .update({ status: 'paid', payment_reference: paymentReference, paid_at: new Date().toISOString() })
      .eq('id', order.id)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .eq('paypal_order_id', body.paypalOrderId)
      .select('id')
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updatedOrder) {
      const { data: currentOrder, error: refreshError } = await admin.from('wallet_orders')
        .select('status,payment_reference')
        .eq('id', order.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (refreshError) throw refreshError;
      if (currentOrder?.status !== 'paid' || currentOrder.payment_reference !== paymentReference) {
        return json({ error: 'Payment was captured but the order could not be marked as paid. Contact support with your PayPal receipt.' }, 409);
      }
    }
    return json({ status: 'completed', orderId: order.id });
  } catch (error) {
    console.error('capture-paypal-order-checkout failed:', error);
    return json({ error: 'Could not verify PayPal payment. The order is not confirmed as paid.' }, 500);
  }
});
