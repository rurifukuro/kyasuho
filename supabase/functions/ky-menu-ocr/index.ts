// supabase/functions/ky-menu-ocr/index.ts — お品書き画像/PDF→メニュー読取り（§53）
//
// 認証: authenticated ユーザー（owner）のみ。月20回/テナント制限。
// AI: Anthropic Claude（claude-sonnet-4-20250514・vision）でお品書き画像を解析し、
// メニュー項目（品名・価格・遠隔価格・カテゴリ推定）を JSON 配列で返す。
// APIキーは Supabase Secrets の ANTHROPIC_API_KEY（R13: クライアント埋め込み禁止）。

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

const MONTHLY_LIMIT = 20;

function jstYearMonth(): string {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 7);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const authHeader = req.headers.get('authorization') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) return json(500, { error: 'api_key_not_configured' });

  // ユーザー認証
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: serviceRoleKey },
  });
  if (!userRes.ok) return json(401, { error: 'unauthorized' });
  const user = (await userRes.json()) as { id: string };

  // テナント解決
  const tenantRes = await fetch(
    `${supabaseUrl}/rest/v1/ky_tenants?owner_user_id=eq.${user.id}&select=id`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
  );
  const tenants = (await tenantRes.json()) as { id: string }[];
  if (!tenants.length) return json(403, { error: 'no_tenant' });
  const tenantId = tenants[0].id;

  const body = await req.json() as { image: string; media_type?: string };
  if (!body.image) return json(400, { error: 'image_required' });
  const mediaType = body.media_type ?? 'image/jpeg';

  // 月次使用量チェック＋インクリメント（JST基準）
  const yearMonth = jstYearMonth();
  const upsertRes = await fetch(
    `${supabaseUrl}/rest/v1/rpc/ky_menu_ocr_increment`,
    {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_tenant_id: tenantId, p_year_month: yearMonth, p_limit: MONTHLY_LIMIT }),
    },
  );
  if (!upsertRes.ok) {
    const err = await upsertRes.json();
    if (err?.message?.includes('limit_exceeded')) return json(429, { error: 'monthly_limit_exceeded' });
    return json(500, { error: 'usage_check_failed', detail: err });
  }

  // Claude Vision でお品書きを解析
  const prompt = `You are a menu OCR assistant for a Japanese cafe/bar (コンカフェ). Analyze this menu image and extract all menu items.

For each item, return:
- name: the item name (Japanese)
- price: the price in yen (integer, no comma/¥ sign)
- remote_price: if a separate "遠隔" or "リモート" price is visible, include it (integer); otherwise null
- category: best guess from these options: set, extension, nomination, cast_drink, drink, food, cheki, other, discount

Return ONLY a valid JSON object: {"items": [...]}
If no items can be extracted, return {"items": []}`;

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: body.image } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text();
    console.error('[ky-menu-ocr] Anthropic API error:', err);
    return json(502, { error: 'ai_error' });
  }

  const aiResult = (await anthropicRes.json()) as { content: { type: string; text: string }[] };
  const textBlock = aiResult.content.find((c) => c.type === 'text');
  if (!textBlock) return json(502, { error: 'no_text_response' });

  // JSON抽出（マークダウンコードブロック対応）
  let parsed: { items: { name: string; price: number; remote_price: number | null; category: string }[] };
  try {
    const raw = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(raw);
  } catch {
    console.error('[ky-menu-ocr] JSON parse failed:', textBlock.text);
    return json(502, { error: 'parse_error' });
  }

  return json(200, parsed);
});
