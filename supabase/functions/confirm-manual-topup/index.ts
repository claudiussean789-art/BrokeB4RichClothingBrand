import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-manual-payment-admin-token',
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
    const adminToken = Deno.env.get('MANUAL_PAYMENT_ADMIN_TOKEN');
    const suppliedToken = request.headers.get('x-manual-payment-admin-token');
    if (!adminToken || !suppliedToken || suppliedToken !== adminToken) {
      return json({ error: 'Not authorized to confirm manual payments.' }, 401);
    }
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) return json({ error: 'Payment service is not configured.' }, 503);
    const body = await request.json();
    if (typeof body.topupId !== 'string' || typeof body.paymentReference !== 'string'
      || body.paymentReference.trim().length < 3 || body.paymentReference.length > 200) {
      return json({ error: 'Valid top-up ID and payment reference are required.' }, 400);
    }
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: topup, error: topupError } = await admin.from('wallet_topups')
      .select('id,method,status').eq('id', body.topupId).maybeSingle();
    if (topupError) throw topupError;
    if (!topup || topup.method !== 'manual') return json({ error: 'Manual top-up was not found.' }, 404);
    const { data: balance, error: completionError } = await admin.rpc('complete_wallet_topup', {
      p_topup_id: topup.id,
      p_payment_reference: `manual:${body.paymentReference.trim()}`,
    });
    if (completionError) throw completionError;
    return json({ status: 'completed', balance });
  } catch (error) {
    console.error('confirm-manual-topup failed:', error);
    return json({ error: 'Could not confirm the manual payment.' }, 500);
  }
});