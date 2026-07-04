import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// 提供者アプリ用 Supabase クライアント。
// ※とれはんっ！は匿名共有モデル（persistSession:false）だが、きゃすりんは認証あり
//   ＝ログイン状態を端末に永続化する（persistSession:true / autoRefreshToken:true）。
// URL/anon キーは EXPO_PUBLIC_ 経由（クライアントJSにバンドル・anon は公開安全＝WEB4）。
//   **service_role キーは絶対に埋め込まない**（R13/WEB4・出荷禁止）。
// 相乗り先: concafe-yoyaku（ref=rhmuitgbvilqwdevxxox）。本番前に専用プロジェクトへ分離（SPEC §12/§19-8）。
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** .env 未設定を検出（AuthScreen で案内し、いきなりクラッシュさせない）。 */
export const hasSupabaseConfig: boolean = url.length > 0 && anonKey.length > 0;

export const supabase: SupabaseClient = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'public-anon-placeholder',
  {
    auth: {
      storage: AsyncStorage,
      persistSession: true, // ログイン状態を端末に永続化
      autoRefreshToken: true, // アクセストークンを自動更新
      detectSessionInUrl: false, // RN/Expo はURLコールバックを使わない
    },
  },
);
