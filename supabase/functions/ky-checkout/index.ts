// supabase/functions/ky-checkout/index.ts — Stripe Checkout セッション作成
//
// 管理WebまたはアプリWebViewから呼ばれ、Stripe Checkoutの決済URLを返す。
// テナントのオーナーのみ利用可。
//
// POST body:
//   { priceIds: string[], successUrl: string, cancelUrl: string }
//   priceIds: Stripe Price ID の配列（subscription / one-time いずれも可）
//
// レスポンス:
//   { url: string }  — Stripe Checkout のリダイレクト先URL
//
// 必要な Secrets:
//   STRIPE_SECRET_KEY  — テストモードは sk_test_... / 本番は sk_live_...
//                        本番キーへの切替はユーザー承認ゲート（W19）
//
// 認証: verify_jwt=true。関数内で /auth/v1/user → ky_tenants.owner_user_id 照合。

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function stripePost(path: string, params: Record<string, string>, apiKey: string): Promise<unknown> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });
  return res.json();
}

async function stripeGet(path: string, apiKey: string): Promise<unknown> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    return json(500, { error: 'stripe_not_configured' });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // JWT からユーザーを解決
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { 'Authorization': authHeader, 'apikey': serviceRoleKey },
  });
  if (!userRes.ok) return json(401, { error: 'unauthorized' });
  const user = (await userRes.json()) as { id: string; email?: string };

  // テナント＋オーナー検証
  const sb = createClient(supabaseUrl, serviceRoleKey);
  const { data: tenant } = await sb
    .from('ky_tenants')
    .select('id, slug, name, stripe_customer_id')
    .eq('owner_user_id', user.id)
    .maybeSingle();
  if (!tenant) return json(403, { error: 'not_owner' });

  let body: { priceIds?: string[]; successUrl?: string; cancelUrl?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const { priceIds, successUrl, cancelUrl } = body;
  if (!priceIds?.length || !successUrl || !cancelUrl) {
    return json(400, { error: 'missing_fields' });
  }
  if (priceIds.length > 20) {
    return json(400, { error: 'too_many_items' });
  }

  // Stripe Customer の取得 or 新規作成
  let customerId = (tenant as Record<string, unknown>).stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripePost('/customers', {
      'email': user.email ?? '',
      'name': (tenant as Record<string, unknown>).name as string,
      'metadata[tenant_id]': (tenant as Record<string, unknown>).id as string,
      'metadata[slug]': (tenant as Record<string, unknown>).slug as string,
    }, stripeKey) as { id?: string; error?: unknown };

    if (!customer.id) {
      return json(502, { error: 'stripe_customer_creation_failed' });
    }
    customerId = customer.id;

    // stripe_customer_id を保存（カラムが存在する場合のみ成功・なければ無視）
    await sb
      .from('ky_tenants')
      .update({ stripe_customer_id: customerId })
      .eq('id', (tenant as Record<string, unknown>).id as string);
  }

  // 全 price を取得して mode を判定（recurring が1つでもあれば subscription）
  let hasRecurring = false;
  for (const pid of priceIds) {
    const price = await stripeGet(`/prices/${encodeURIComponent(pid)}`, stripeKey) as { recurring?: unknown };
    if (price.recurring) {
      hasRecurring = true;
      break;
    }
  }

  // Checkout Session パラメータ組み立て
  const params: Record<string, string> = {
    'customer': customerId,
    'mode': hasRecurring ? 'subscription' : 'payment',
    'success_url': successUrl,
    'cancel_url': cancelUrl,
    'client_reference_id': (tenant as Record<string, unknown>).id as string,
    'metadata[tenant_id]': (tenant as Record<string, unknown>).id as string,
    'locale': 'ja',
    'allow_promotion_codes': 'true',
  };

  // 初月無料トライアル（subscription モードのみ）
  if (hasRecurring) {
    params['subscription_data[trial_period_days]'] = '30';
    params['subscription_data[metadata][tenant_id]'] = (tenant as Record<string, unknown>).id as string;
  }

  // line_items
  priceIds.forEach((pid, i) => {
    params[`line_items[${i}][price]`] = pid;
    params[`line_items[${i}][quantity]`] = '1';
  });

  const session = await stripePost('/checkout/sessions', params, stripeKey) as { url?: string; error?: { message?: string } };

  if (!session.url) {
    console.error('[ky-checkout] Stripe session creation failed:', JSON.stringify(session));
    return json(502, { error: 'checkout_session_failed', detail: (session.error as Record<string, unknown>)?.message });
  }

  return json(200, { url: session.url });
});
