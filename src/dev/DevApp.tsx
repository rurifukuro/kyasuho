import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AdminLogin } from '../admin/AdminLogin';
import { checkPlatformAdmin } from './devApi';
import { DevDashboard } from './DevDashboard';

export default function DevApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const verifyAdmin = useCallback(async () => {
    if (!session) { setIsAdmin(null); return; }
    try {
      setIsAdmin(await checkPlatformAdmin());
    } catch {
      setIsAdmin(false);
    }
  }, [session]);

  useEffect(() => { void verifyAdmin(); }, [verifyAdmin]);

  if (!authReady) {
    return <div className="loading">読み込み中…</div>;
  }

  if (!session) {
    return <AdminLogin />;
  }

  if (isAdmin === null) {
    return <div className="loading">権限を確認中…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <h1>ページが見つかりません</h1>
          <button
            type="button"
            className="admin-btn"
            onClick={() => void supabase.auth.signOut()}
          >
            ログアウト
          </button>
        </div>
      </div>
    );
  }

  return <DevDashboard />;
}
