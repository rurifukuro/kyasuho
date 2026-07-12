// src/services/faqAi.ts — Q&A AIアシスタント（Edge Function `ky-faq-ai`・SPEC §46）
//
// 3層アーキテクチャ（第1層FAQ照合→第2層Sonnet→第3層Web検索）はサーバー側で完結。
// クライアントは質問＋会話履歴＋文脈（呼び出し元画面の情報）を送るだけ。
// 履歴は端末セッション内のみ保持（サーバーに会話状態は持たない）。

import { supabase } from '../config/supabase';

export type FaqChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type FaqAiResult = {
  answer: string;
  layerUsed: 'faq' | 'sonnet' | 'web' | 'refused';
};

export const FAQ_DAILY_LIMIT = 20;

export async function askFaqAi(
  question: string,
  history: FaqChatMessage[],
  context?: string,
): Promise<FaqAiResult> {
  const { data, error } = await supabase.functions.invoke('ky-faq-ai', {
    body: {
      question,
      history,
      ...(context ? { context } : {}),
    },
  });
  if (error) {
    // 429（日次上限）はメッセージで区別できるようにエラー本文を読む
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        const body = (await ctx.json()) as { error?: string };
        if (body.error === 'daily_limit_exceeded') {
          throw new Error('daily_limit_exceeded');
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'daily_limit_exceeded') throw e;
    }
    throw error;
  }
  const result = data as { answer: string; layer_used: FaqAiResult['layerUsed'] };
  return { answer: result.answer, layerUsed: result.layer_used };
}
