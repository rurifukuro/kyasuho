import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';

export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      console.warn('[kyasuho] admin login failed:', signInError.message);
      setError(
        signInError.message.includes('Invalid login credentials')
          ? 'メールアドレスまたはパスワードが違います。'
          : 'ログインに失敗しました。時間をおいて再度お試しください。',
      );
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (resetError) {
      console.warn('[kyasuho] password reset failed:', resetError.message);
      setError('リセットメールの送信に失敗しました。メールアドレスを確認してください。');
      setBusy(false);
      return;
    }
    setResetSent(true);
    setBusy(false);
  };

  if (resetMode) {
    return (
      <div className="admin-login-page">
        <form className="admin-login-card" onSubmit={handleReset}>
          <h1>きゃすりん</h1>
          <p className="admin-login-sub">パスワードリセット</p>
          {resetSent ? (
            <>
              <p className="admin-success">
                パスワードリセット用のメールを送信しました。メール内のリンクから新しいパスワードを設定してください。
              </p>
              <button
                type="button"
                className="admin-btn"
                onClick={() => { setResetMode(false); setResetSent(false); setError(null); }}
              >
                ログインに戻る
              </button>
            </>
          ) : (
            <>
              <div className="admin-field">
                <label htmlFor="admin-reset-email">メールアドレス</label>
                <input
                  id="admin-reset-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {error ? <p className="admin-error">{error}</p> : null}
              <button type="submit" className="admin-btn primary" disabled={busy}>
                {busy ? '送信中…' : 'リセットメールを送信'}
              </button>
              <button
                type="button"
                className="admin-link-btn"
                onClick={() => { setResetMode(false); setError(null); }}
              >
                ログインに戻る
              </button>
            </>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="admin-login-page">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <h1>きゃすりん</h1>
        <p className="admin-login-sub">店舗管理（PC版）にログイン</p>
        <div className="admin-field">
          <label htmlFor="admin-email">メールアドレス</label>
          <input
            id="admin-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="admin-field">
          <label htmlFor="admin-password">パスワード</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? <p className="admin-error">{error}</p> : null}
        <button type="submit" className="admin-btn primary" disabled={busy}>
          {busy ? 'ログイン中…' : 'ログイン'}
        </button>
        <button
          type="button"
          className="admin-link-btn"
          onClick={() => { setResetMode(true); setError(null); }}
        >
          パスワードをお忘れですか？
        </button>
        <p className="admin-note">
          アカウントの新規登録は「きゃすりん」アプリから行ってください。アプリと同じメールアドレス・パスワードでログインできます。
        </p>
      </form>
    </div>
  );
}
