import { supabase } from '../config/supabase';

// サインイン後、当該ユーザーのテナント（店舗）が無ければ仮テナントを1件作成する。
// SPEC §12「1アカウント1店舗・サインアップ直後に ky_tenants を作成」を、メール確認 ON/OFF
// どちらでも動くよう「セッション確立後に無ければ作る」形にした（確認ONだと signUp 直後は
// セッションが無いため）。店名/slug/ジャンルは後の StoreSetupScreen（受付設定Rev）で編集する。
// RLS の with check が owner_user_id=auth.uid() を強制するので、他人テナントの詐称は起きない。
export async function ensureTenant(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('ky_tenants')
    .select('id')
    .eq('owner_user_id', userId)
    .maybeSingle();
  if (error) throw error; // BE-2: 握りつぶさず呼び出し元へ
  if (data) return; // 既に存在

  const shortId = userId.replace(/-/g, '').slice(0, 8);
  const { error: insertError } = await supabase.from('ky_tenants').insert({
    slug: `shop-${shortId}`,
    name: 'マイ店舗',
    genre: '',
    owner_user_id: userId,
    business_info: {},
  });
  if (insertError) throw insertError;
}
