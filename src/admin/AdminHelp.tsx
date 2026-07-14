// web/src/admin/AdminHelp.tsx — Q&A AIアシスタント（ヘルプ）ページ（SPEC §46）
//
// アプリ側 HelpChatModal と同型のチャットUI（3層アーキテクチャの呼び分けはサーバー側）。
// ・履歴はブラウザセッション内のみ（ページ遷移で消える＝サーバーに会話状態を持たない）
// ・行き止まり禁止（WEB6）: AIで解決しない場合のお問い合わせフォーム導線を常時表示

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KyTenant } from '../lib/types';
import { askFaqAi, type FaqChatMessage } from './adminApi';

const CONTACT_FORM_URL = 'https://forms.gle/RMWGLzRdyzdnPSas5';

const WELCOME_TEXT =
  'こんにちは！きゃすりんのAIアシスタントです。使い方・料金・トラブルなど、お気軽にご質問ください。';
const LIMIT_TEXT =
  '本日のご質問回数の上限（20回）に達しました。明日以降に改めてお試しいただくか、お問い合わせフォームをご利用ください。';
const ERROR_TEXT =
  '回答の取得に失敗しました。通信環境をご確認のうえ、もう一度お試しください。';

export function AdminHelp({ tenant: _tenant }: { tenant: KyTenant }) {
  const [messages, setMessages] = useState<FaqChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;
    const history = messages;
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    setLoading(true);
    try {
      const result = await askFaqAi(question, history);
      setMessages((prev) => [...prev, { role: 'assistant', content: result.answer }]);
    } catch (e) {
      const msg =
        e instanceof Error && e.message === 'daily_limit_exceeded' ? LIMIT_TEXT : ERROR_TEXT;
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enterで送信・Shift+Enterで改行（IME変換確定のEnterは isComposing で除外）
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div>
      <h2 className="admin-page-title">ヘルプ（AIアシスタント）</h2>
      <div className="admin-card admin-help-card">
        <div className="admin-help-log" ref={logRef}>
          <div className="admin-help-bubble assistant">{WELCOME_TEXT}</div>
          {messages.map((m, i) => (
            <div key={i} className={`admin-help-bubble ${m.role}`}>
              {m.content}
            </div>
          ))}
          {loading && <div className="admin-help-bubble assistant thinking">回答を作成中…</div>}
        </div>
        <div className="admin-help-disclaimer">
          AIによる自動回答です。解決しない場合は
          <a href={CONTACT_FORM_URL} target="_blank" rel="noreferrer">
            お問い合わせフォーム
          </a>
          へご連絡ください。
        </div>
        <div className="admin-help-input-row">
          <textarea
            className="admin-help-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="質問を入力…（Enterで送信・Shift+Enterで改行）"
            maxLength={1000}
            rows={2}
          />
          <button
            type="button"
            className="admin-btn primary"
            onClick={() => void handleSend()}
            disabled={!input.trim() || loading}
          >
            送信
          </button>
        </div>
      </div>
    </div>
  );
}
