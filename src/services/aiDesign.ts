// src/services/aiDesign.ts — AIシフトデザイン生成（Edge Function `ky-shift-design`・SPEC §22）
//
// 返り値は raw デザイン（検証・完全定義化は shiftTemplates/aiDesign.ts の buildAiDefinition）。
// 失敗時は Edge Function のエラーコード（rate_limit / global_limit 等）を message に載せて投げる。
// APIキーはサーバー側 Secret のみ（R13: クライアント埋め込み禁止）。

import { supabase } from '../config/supabase';

export async function requestAiShiftDesign(mood: string, storeName: string): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('ky-shift-design', {
    body: { mood, store_name: storeName },
  });
  if (error) {
    let code = '';
    try {
      // FunctionsHttpError.context はレスポンス相当（RN環境のため構造型で扱う）
      const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
      if (ctx && typeof ctx.json === 'function') {
        code = ((await ctx.json()) as { error?: string }).error ?? '';
      }
    } catch (e: unknown) {
      console.warn('[kyasuho] ky-shift-design error body unreadable:', e);
    }
    throw new Error(code || (error as Error).message);
  }
  const design = (data as { design?: unknown } | null)?.design;
  if (design === undefined || design === null) throw new Error('bad_ai_output');
  return design;
}
