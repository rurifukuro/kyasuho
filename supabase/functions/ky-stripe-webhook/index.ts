// supabase/functions/ky-stripe-webhook/index.ts — Stripe Webhook受信
//
// Stripe からのイベント通知を受信し、課金台帳を更新する。
// BILL-2 先行の骨組み＝イベントルーティング枠のみ。台帳RPCは BILL-1 で実装。
//
// 必要な Secrets:
//   STRIPE_SECRET_KEY     — Stripe API キー
//   STRIPE_WEBHOOK_SECRET — Stripe Dashboard > Webhooks > Signing secret
//
// verify_jwt=false: Stripe からの直接呼出のため JWT 認証なし。
// 認証: Stripe-Signature ヘッダーで HMAC 検証。

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = sigHeader.split(',').reduce(
    (acc, part) => {
      const [key, val] = part.split('=');
      if (key === 't') acc.timestamp = val;
      if (key === 'v1') acc.signatures.push(val);
      return acc;
    },
    { timestamp: '', signatures: [] as string[] },
  );

  if (!parts.timestamp || parts.signatures.length === 0) return false;

  const signedPayload = `${parts.timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return parts.signatures.includes(expected);
}

// --- イベントハンドラ（BILL-1/BILL-2 で中身を実装） ---

async function handleCheckoutCompleted(
  _event: Record<string, unknown>,
  _supabase: ReturnType<typeof createClient>,
): Promise<void> {
  // BILL-2: checkout.session.completed
  // → ky_billing_subscriptions 作成 / ky_payment_events 記帳
  // → recompute_tenant_entitlements RPC 呼出
  console.log('[ky-stripe-webhook] checkout.session.completed (stub)');
}

async function handleInvoicePaid(
  _event: Record<string, unknown>,
  _supabase: ReturnType<typeof createClient>,
): Promise<void> {
  // BILL-2: invoice.paid
  // → ky_payment_events 記帳 / ky_billing_invoices upsert
  console.log('[ky-stripe-webhook] invoice.paid (stub)');
}

async function handleSubscriptionUpdated(
  _event: Record<string, unknown>,
  _supabase: ReturnType<typeof createClient>,
): Promise<void> {
  // BILL-2: customer.subscription.updated
  // → ky_billing_subscriptions.status / current_period_end 更新
  // → recompute_tenant_entitlements RPC
  console.log('[ky-stripe-webhook] customer.subscription.updated (stub)');
}

async function handleSubscriptionDeleted(
  _event: Record<string, unknown>,
  _supabase: ReturnType<typeof createClient>,
): Promise<void> {
  // BILL-2: customer.subscription.deleted
  // → ky_billing_subscriptions.status='canceled'
  // → recompute_tenant_entitlements RPC（降格）
  console.log('[ky-stripe-webhook] customer.subscription.deleted (stub)');
}

// --- メインハンドラ ---

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('[ky-stripe-webhook] STRIPE_WEBHOOK_SECRET not set');
    return json(500, { error: 'server_config_error' });
  }

  const sigHeader = req.headers.get('stripe-signature');
  if (!sigHeader) {
    return json(400, { error: 'missing_signature' });
  }

  const body = await req.text();

  const valid = await verifyStripeSignature(body, sigHeader, webhookSecret);
  if (!valid) {
    console.warn('[ky-stripe-webhook] signature verification failed');
    return json(401, { error: 'invalid_signature' });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body);
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const eventType = event.type as string;
  console.log(`[ky-stripe-webhook] received: ${eventType}`);

  try {
    switch (eventType) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event, supabase);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event, supabase);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event, supabase);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event, supabase);
        break;
      default:
        console.log(`[ky-stripe-webhook] unhandled event type: ${eventType}`);
    }
  } catch (err) {
    console.error(`[ky-stripe-webhook] handler error for ${eventType}:`, err);
    return json(500, { error: 'handler_error' });
  }

  return json(200, { received: true });
});
