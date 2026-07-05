import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';

export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    // 成功時は AdminApp 側の onAuthStateChange が画面を切り替える
    setBusy(false);
  };

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
        <p className="admin-note">
          アカウントの新規登録は「きゃすりん」アプリから行ってください。アプリと同じメールアドレス・パスワードでログインできます。
        </p>
      </form>
    </div>
  );
}
