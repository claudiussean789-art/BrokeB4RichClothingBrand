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
      .select('id,user_id,amount,currency,method,status,receipt_email_sent_at').eq('id', body.topupId).maybeSingle();
    if (topupError) throw topupError;
    if (!topup || topup.method !== 'manual') return json({ error: 'Manual top-up was not found.' }, 404);
    if (!topup.receipt_email_sent_at && topup.status === 'pending') {
      const { data: receipt, error: receiptError } = await admin.from('wallet_topups')
        .select('receipt_path,customer_payment_reference').eq('id', topup.id).maybeSingle();
      if (receiptError) throw receiptError;
      if (!receipt?.receipt_path || !receipt.customer_payment_reference) {
        return json({ error: 'The customer has not submitted a transfer receipt and reference.' }, 409);
      }
    }
    const { data: balance, error: completionError } = await admin.rpc('complete_wallet_topup', {
      p_topup_id: topup.id,
      p_payment_reference: `manual:${body.paymentReference.trim()}`,
    });
    if (completionError) throw completionError;
    if (topup.receipt_email_sent_at) return json({ status: 'completed', balance, receiptEmailSent: true });

    try {
      const emailApiKey = Deno.env.get('RESEND_API_KEY');
      const fromEmail = Deno.env.get('PAYMENT_RECEIPT_FROM_EMAIL');
      const { data: profile, error: profileError } = await admin.from('profiles')
        .select('email,full_name').eq('id', topup.user_id).maybeSingle();
      if (profileError) throw profileError;
      if (!emailApiKey || !fromEmail || !profile?.email) {
        return json({
          status: 'completed',
          balance,
          receiptEmailSent: false,
          warning: 'Wallet credit was added, but email receipt delivery is not configured.',
        });
      }

      const safeName = escapeHtml(profile.full_name || 'Customer');
      const safeReference = escapeHtml(body.paymentReference.trim());
      const amount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: topup.currency,
      }).format(Number(topup.amount));
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${emailApiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `wallet-topup-${topup.id}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [profile.email],
          subject: 'Your wallet top-up receipt',
          html: `<p>Hello ${safeName},</p><p>Your NCB bank transfer was verified and <strong>${amount}</strong> has been added to your wallet.</p><p>Payment reference: ${safeReference}<br>Top-up ID: ${topup.id}<br>Wallet balance: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(balance))}</p><p>Thank you.</p>`,
          text: `Hello ${profile.full_name || 'Customer'}, your NCB bank transfer was verified and ${amount} has been added to your wallet.\nPayment reference: ${body.paymentReference.trim()}\nTop-up ID: ${topup.id}\nWallet balance: ${Number(balance).toFixed(2)} ${topup.currency}`,
        }),
      });
      if (!emailResponse.ok) {
        const details = await emailResponse.text();
        console.error('Top-up receipt email failed:', emailResponse.status, details);
        return json({
          status: 'completed',
          balance,
          receiptEmailSent: false,
          warning: 'Wallet credit was added, but the receipt email could not be delivered. Retry confirmation to send it again.',
        });
      }
      const { error: emailUpdateError } = await admin.from('wallet_topups')
        .update({ receipt_email_sent_at: new Date().toISOString() }).eq('id', topup.id).is('receipt_email_sent_at', null);
      if (emailUpdateError) throw emailUpdateError;
      return json({ status: 'completed', balance, receiptEmailSent: true });
    } catch (emailError) {
      console.error('Wallet credited but receipt email delivery failed:', emailError);
      return json({
        status: 'completed',
        balance,
        receiptEmailSent: false,
        warning: 'Wallet credit was added, but the receipt email could not be delivered. Retry confirmation to send it again.',
      });
    }
  } catch (error) {
    console.error('confirm-manual-topup failed:', error);
    return json({ error: 'Could not confirm the manual payment.' }, 500);
  }
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}