// supabase/functions/ky-shift-analyze/index.ts — 店舗テンプレート画像AI解析（SPEC §22-3）
//
// アップロードされた店舗の既存シフト表画像を Claude Vision で解析し、
// グリッド構造・配置領域・配色を検出して ShiftPlacement 相当のJSONを返す。
// 店舗が「空テンプレート」を用意しなくても、完成品シフト表から構造を抽出する。
//
// 認証・レート制限は ky-shift-design と同一パターン（reserve_ky_ai_slot RPC）。

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

const PER_TENANT_DAILY_LIMIT = 20;
const GLOBAL_DAILY_LIMIT = 400;

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;

const ANALYSIS_PROMPT = `あなたはコンセプトカフェのシフト表画像の解析エキスパートです。
アップロードされた画像はコンセプトカフェの既存シフト表（データ入り）です。
この画像のレイアウト構造を正確に解析し、データの配置領域をJSON形式で返してください。

次のJSONオブジェクトだけを出力してください。説明文・前置き・コードフェンスは一切禁止です。

{
  "type": "monthly" または "daily",
  "gridArea": {
    "x": グリッド領域の左端（画像幅に対する割合 0.00〜1.00・小数2桁）,
    "y": グリッド領域の上端（画像高さに対する割合 0.00〜1.00）,
    "w": グリッド領域の幅（画像幅に対する割合）,
    "h": グリッド領域の高さ（画像高さに対する割合）
  },
  "titleArea": {
    "x": タイトル/ロゴ領域の左端,
    "y": タイトル/ロゴ領域の上端,
    "w": タイトル/ロゴ領域の幅,
    "h": タイトル/ロゴ領域の高さ
  },
  "cols": 列数（monthlyは通常7）,
  "rows": 行数（データ行のみ。ヘッダー行は含まない）,
  "hasHeaderRow": 曜日ラベル等のヘッダー行があるか（true/false）,
  "cellBg": セル内部の背景色（hex #RRGGBB）,
  "textColor": キャスト名など主要テキストの色（hex）,
  "timeColor": 時間テキストの色（hex）,
  "accentColor": 見出し・曜日・装飾のアクセント色（hex）
}

解析の指針:
- type: 7列の月間カレンダー形式＝"monthly"。写真カード型の当日出勤キャスト一覧＝"daily"
- gridArea: キャスト情報が配置されているグリッド全体の領域。外側の枠線を含む
- titleArea: 店名・月名・タイトルが表示されている領域（グリッドの上に位置することが多い）
- rows: monthlyは表示されている週の数。dailyは写真カードの行数
- hasHeaderRow: 曜日名（日,月,火…やSUN,MON…）の行があるか
- cellBg: 各セルの地色。白背景なら"#FFFFFF"
- 座標は画像の左上=(0,0)・右下=(1,1)の相対値。端の装飾は含めず、セルグリッドの外枠を基準にする`;

function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB上限（メモリ・API費用の防御）

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mediaType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image fetch failed: ${res.status}`);
  const ct = res.headers.get('content-type') ?? 'image/jpeg';
  if (!ct.startsWith('image/')) throw new Error(`not an image: ${ct}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_IMAGE_BYTES) throw new Error(`image too large: ${buf.byteLength}`);
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  const base64 = btoa(binary);
  const mediaType = ct.startsWith('image/') ? ct.split(';')[0]! : 'image/jpeg';
  return { base64, mediaType };
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
    return json(500, { error: 'server_not_configured' });
  }

  // ── 入力 ──
  let imageUrl = '';
  try {
    const body = (await req.json()) as { image_url?: unknown };
    if (typeof body.image_url === 'string') imageUrl = body.image_url.trim();
  } catch {
    return json(400, { error: 'bad_request' });
  }
  if (!imageUrl) {
    return json(400, { error: 'bad_request' });
  }

  // ── 認証 ──
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return json(401, { error: 'unauthorized' });

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${jwt}` },
  });
  if (!userRes.ok) return json(401, { error: 'unauthorized' });
  const user = (await userRes.json()) as { id?: string };
  const uid = typeof user.id === 'string' ? user.id : '';
  if (!uid) return json(401, { error: 'unauthorized' });

  // ── テナント解決 ──
  const tenantRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ky_tenants?owner_user_id=eq.${uid}&select=id&limit=1`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!tenantRes.ok) return json(500, { error: 'server_error' });
  const tenants = (await tenantRes.json()) as Array<{ id: string }>;
  if (!tenants[0]) return json(403, { error: 'forbidden' });

  // ── SSRF防止: 取得先を自テナントのシフト背景バケットに限定 ──
  // uploadShiftBackground（adminApi.ts）が発行する公開URLだけを受け付ける。
  const allowedPrefix = `${SUPABASE_URL}/storage/v1/object/public/ky-shift-backgrounds/${tenants[0].id}/`;
  if (!imageUrl.startsWith(allowedPrefix)) {
    return json(400, { error: 'bad_request' });
  }

  // ── レート制限 ──
  const slotRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reserve_ky_ai_slot`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_tenant_id: tenants[0].id }),
  });
  if (!slotRes.ok) return json(500, { error: 'server_error' });
  const slots = (await slotRes.json()) as Array<{ per_tenant: number; global: number }>;
  const slot = slots[0];
  if (!slot) return json(500, { error: 'server_error' });
  if (slot.per_tenant > PER_TENANT_DAILY_LIMIT) return json(429, { error: 'rate_limit' });
  if (slot.global > GLOBAL_DAILY_LIMIT) return json(503, { error: 'global_limit' });

  // ── 画像取得→base64 ──
  let imgData: { base64: string; mediaType: string };
  try {
    imgData = await fetchImageAsBase64(imageUrl);
  } catch (e) {
    console.error('image fetch error:', e);
    return json(400, { error: 'image_fetch_failed' });
  }

  // ── Claude Vision 呼び出し ──
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
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: imgData.mediaType,
                data: imgData.base64,
              },
            },
            { type: 'text', text: ANALYSIS_PROMPT },
          ],
        },
      ],
    }),
  });
  if (!aiRes.ok) {
    console.error('Claude API error:', aiRes.status, await aiRes.text());
    return json(502, { error: 'upstream_error' });
  }
  const aiData = (await aiRes.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = aiData.content?.find((c) => typeof c.text === 'string')?.text ?? '';
  const jsonText = extractJsonObject(text);
  if (!jsonText) return json(502, { error: 'bad_ai_output' });

  let placement: unknown;
  try {
    placement = JSON.parse(jsonText);
  } catch {
    return json(502, { error: 'bad_ai_output' });
  }

  return json(200, { placement });
});
