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
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char
));

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Authentication required.' }, 401);
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromAddress = Deno.env.get('TRACKING_EMAIL_FROM');
    if (!url || !anonKey || !serviceKey || !resendKey || !fromAddress) {
      return json({ error: 'Tracking emails are not configured.' }, 503);
    }

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: isAdmin, error: adminError } = await userClient.rpc('is_store_admin');
    if (adminError || isAdmin !== true) return json({ error: 'Admin access required.' }, 403);

    const body = await request.json();
    if (typeof body.orderId !== 'string') return json({ error: 'Order ID is required.' }, 400);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: order, error: orderError } = await admin.from('wallet_orders')
      .select('id,customer,items,tracking_number,tracking_carrier')
      .eq('id', body.orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json({ error: 'Order not found.' }, 404);
    if (!order.tracking_number) return json({ error: 'Save a tracking number first.' }, 409);

    const customer = (typeof order.customer === 'string' ? JSON.parse(order.customer) : order.customer) ?? {};
    const email = typeof customer.email === 'string' ? customer.email.trim() : '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'This order has no valid customer email.' }, 422);

    const carrier = order.tracking_carrier || 'Knutsford Express';
    const name = escapeHtml(String(customer.full_name || 'there'));
    const items = (Array.isArray(order.items) ? order.items : [])
      .map((item: { name?: string }) => `<li>${escapeHtml(String(item.name ?? 'Item'))}</li>`)
      .join('');
    const orderRef = String(order.id).slice(0, 8);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject: `Your BrokeB4Rich order ${orderRef} has shipped`,
        html: `<p>Hi ${name},</p>
<p>Your BrokeB4Rich order <strong>${orderRef}</strong> has shipped via <strong>${escapeHtml(carrier)}</strong>.</p>
<p>Tracking number: <strong>${escapeHtml(String(order.tracking_number))}</strong></p>
<ul>${items}</ul>
<p>Thank you for supporting BrokeB4Rich.</p>`,
      }),
    });
    if (!response.ok) throw new Error(`Email provider rejected the request (${response.status}).`);
    return json({ sent: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not send the tracking email.' }, 500);
  }
});
