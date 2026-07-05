// supabase/functions/ky-shift-design/index.ts — AIシフトデザイン生成（SPEC §22）
//
// 店の雰囲気テキスト＋店名から、シフト表テンプレートのデザインパラメータ
// （palette / fonts / layout / headerStyle / motif / cornerRadius / cellGap / name）を
// Claude に JSON で生成させて返す。レイアウト数値の最終クランプと完全定義化は
// クライアント側 shiftTemplates/aiDesign.ts の buildAiDefinition が行う（二重防御）。
//
// 認証: verify_jwt=true でデプロイ（ゲートウェイが JWT 署名検証）。ただし anon key の
// JWT もゲートウェイは通すため、関数内で /auth/v1/user によりユーザー実在を確認し、
// ky_tenants.owner_user_id 照合で tenant を解決する（オーナー以外は 403）。
//
// レート制限: reserve_ky_ai_slot RPC（service_role 専用・migration 0010）。
// 予約方式＝先に +1 してから判定するため、同時リクエストでも上限を突き破らない。
//
// APIキーは Supabase Secrets の ANTHROPIC_API_KEY のみ（R13: クライアント埋め込み禁止）。

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

const PER_TENANT_DAILY_LIMIT = 20; // 1テナントあたり日次上限
const GLOBAL_DAILY_LIMIT = 400; // 全体日次上限（暴走・悪用の最終ブレーキ）

const MODEL = 'claude-haiku-4-5-20251001'; // 構造化JSON小出力＝haikuで十分
const MAX_TOKENS = 1024;

function buildPrompt(mood: string, storeName: string): string {
  return `あなたはコンセプトカフェのシフト表画像のアートディレクターです。店の雰囲気の説明に合う配色デザインを1つ作ってください。

店名: ${storeName}
雰囲気: ${mood}

次のJSONオブジェクトだけを出力してください。説明文・前置き・コードフェンスは一切禁止です。

{
  "name": "デザイン名（日本語・12文字以内）",
  "palette": {
    "bg": "#RRGGBB",
    "bgGradient": ["#RRGGBB", "#RRGGBB"],
    "headerText": "#RRGGBB",
    "dayLabel": "#RRGGBB",
    "castName": "#RRGGBB",
    "timeText": "#RRGGBB",
    "accent": "#RRGGBB",
    "cellBg": "#RRGGBB または #RRGGBBAA",
    "cellBorder": "#RRGGBB または #RRGGBBAA"
  },
  "fonts": { "header": "serif-jp か sans-jp か rounded-jp", "body": "serif-jp か sans-jp か rounded-jp" },
  "layout": "month-grid か week-rows",
  "headerStyle": "ribbon か plain か underline",
  "motif": "stars か hearts か flowers か sakura か lightning か none",
  "cornerRadius": 0から28の整数,
  "cellGap": 4から12の整数
}

制約:
- 色はすべてhex表記（#RRGGBB / #RRGGBBAA）。色名やrgb()は禁止。
- castName はセル背景 cellBg の上に載る。コントラスト比4.5:1以上を必ず確保（可読性最優先）。
- headerText は bg（bgGradientがあればその中間色）の上に載る。コントラスト比4.5:1以上。
- dayLabel / timeText も背景に対して読める濃さにする。
- bgGradient は上→下の順。単色にしたい場合はキーごと省略してよい。
- 雰囲気の言葉（かわいい/シック/和風/ネオン等）に合わせて書体・モチーフ・角丸を選ぶ。`;
}

/** コードフェンスや前置きが混じっても最初の { から最後の } までを取り出す */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANTHROPIC_API_KEY) {
    // ANTHROPIC_API_KEY 未登録時はレート枠を消費せずここで止まる
    return json(500, { error: 'server_not_configured' });
  }

  // ── 入力（ホワイトリスト検証） ──
  let mood = '';
  let storeNameInput = '';
  try {
    const body = (await req.json()) as { mood?: unknown; store_name?: unknown };
    if (typeof body.mood === 'string') mood = body.mood.trim();
    if (typeof body.store_name === 'string') storeNameInput = body.store_name.trim();
  } catch {
    return json(400, { error: 'bad_request' });
  }
  if (!mood || mood.length > 500) {
    return json(400, { error: 'bad_request' });
  }
  if (storeNameInput.length > 100) {
    storeNameInput = storeNameInput.slice(0, 100);
  }

  // ── 認証: ユーザーJWT → ユーザー実在確認 ──
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) {
    return json(401, { error: 'unauthorized' });
  }
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${jwt}` },
  });
  if (!userRes.ok) {
    return json(401, { error: 'unauthorized' });
  }
  const user = (await userRes.json()) as { id?: string };
  const uid = typeof user.id === 'string' ? user.id : '';
  if (!uid) {
    // anon key の JWT はゲートウェイを通るが user を持たない → ここで遮断
    return json(401, { error: 'unauthorized' });
  }

  // ── テナント解決（オーナー照合） ──
  const tenantRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ky_tenants?owner_user_id=eq.${uid}&select=id,name&limit=1`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!tenantRes.ok) {
    return json(500, { error: 'server_error' });
  }
  const tenants = (await tenantRes.json()) as Array<{ id: string; name: string }>;
  const tenant = tenants[0];
  if (!tenant) {
    return json(403, { error: 'forbidden' });
  }

  // ── レート制限（予約方式） ──
  const slotRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reserve_ky_ai_slot`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_tenant_id: tenant.id }),
  });
  if (!slotRes.ok) {
    return json(500, { error: 'server_error' });
  }
  const slots = (await slotRes.json()) as Array<{ per_tenant: number; global: number }>;
  const slot = slots[0];
  if (!slot) {
    return json(500, { error: 'server_error' });
  }
  if (slot.per_tenant > PER_TENANT_DAILY_LIMIT) {
    return json(429, { error: 'rate_limit' });
  }
  if (slot.global > GLOBAL_DAILY_LIMIT) {
    return json(503, { error: 'global_limit' });
  }

  // ── Claude 呼び出し ──
  const storeName = storeNameInput || tenant.name;
  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: buildPrompt(mood, storeName) }],
    }),
  });
  if (!aiRes.ok) {
    return json(502, { error: 'upstream_error' });
  }
  const aiData = (await aiRes.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = aiData.content?.find((c) => typeof c.text === 'string')?.text ?? '';
  const jsonText = extractJsonObject(text);
  if (!jsonText) {
    return json(502, { error: 'bad_ai_output' });
  }
  let design: unknown;
  try {
    design = JSON.parse(jsonText);
  } catch {
    return json(502, { error: 'bad_ai_output' });
  }

  return json(200, { design });
});
