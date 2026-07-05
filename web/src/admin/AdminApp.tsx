import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { KyTenant } from '../lib/types';
import { fetchOwnTenant } from './adminApi';
import { AdminLogin } from './AdminLogin';
import { AdminLayout } from './AdminLayout';
import { AdminReservations } from './AdminReservations';
import { AdminSchedule } from './AdminSchedule';
import { AdminCasts } from './AdminCasts';
import { AdminSales } from './AdminSales';
import { AdminPayroll } from './AdminPayroll';
import { AdminAttendance } from './AdminAttendance';
import { AdminPlaceholder } from './AdminPlaceholder';
import './admin.css';

export default function AdminApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tenant, setTenant] = useState<KyTenant | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const loadTenant = useCallback(async () => {
    if (!session) {
      setTenant(null);
      setTenantError(null);
      return;
    }
    setTenantLoading(true);
    setTenantError(null);
    try {
      const own = await fetchOwnTenant();
      setTenant(own);
      if (!own) {
        setTenantError(
          'このアカウントには店舗が登録されていません。先に「きゃすりん」アプリで店舗を作成してください。',
        );
      }
    } catch (e) {
      console.warn('[kyasuho] fetchOwnTenant failed:', e);
      setTenantError('店舗情報の取得に失敗しました。再読み込みしてください。');
    } finally {
      setTenantLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void loadTenant();
  }, [loadTenant]);

  if (!authReady) {
    return <div className="loading">読み込み中…</div>;
  }
  if (!session) {
    return <AdminLogin />;
  }
  if (tenantLoading) {
    return <div className="loading">店舗情報を取得中…</div>;
  }
  if (!tenant) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <h1>きゃすりん</h1>
          <p className="admin-error">{tenantError ?? '店舗情報を取得できませんでした。'}</p>
          <div className="admin-btn-row" style={{ marginTop: 12 }}>
            <button type="button" className="admin-btn" onClick={() => void loadTenant()}>
              再読み込み
            </button>
            <button
              type="button"
              className="admin-btn danger"
              onClick={() => void supabase.auth.signOut()}
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AdminLayout tenant={tenant} />}>
        <Route index element={<Navigate to="reservations" replace />} />
        <Route path="reservations" element={<AdminReservations tenant={tenant} />} />
        <Route path="schedule" element={<AdminSchedule tenant={tenant} />} />
        <Route path="casts" element={<AdminCasts tenant={tenant} />} />
        <Route path="sales" element={<AdminSales tenant={tenant} />} />
        <Route path="payroll" element={<AdminPayroll tenant={tenant} />} />
        <Route path="attendance" element={<AdminAttendance tenant={tenant} />} />
        <Route path="shift-image" element={<AdminPlaceholder title="シフト表作成" />} />
        <Route path="*" element={<Navigate to="reservations" replace />} />
      </Route>
    </Routes>
  );
}
