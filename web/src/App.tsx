import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TenantPage } from './components/TenantPage';

// 管理Web（#/admin）は店舗スタッフしか使わないため、客側と分けて遅延読み込みする（SPEC §21）
const AdminApp = lazy(() => import('./admin/AdminApp'));
const DevApp = lazy(() => import('./dev/DevApp'));

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<div className="loading">読み込み中…</div>}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route
          path="/dev/*"
          element={
            <Suspense fallback={<div className="loading">読み込み中…</div>}>
              <DevApp />
            </Suspense>
          }
        />
        <Route path="/:slug" element={<TenantPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
