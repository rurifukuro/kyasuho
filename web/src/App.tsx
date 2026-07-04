import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TenantPage } from './components/TenantPage';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/:slug" element={<TenantPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
