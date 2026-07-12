import { NavLink, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { KyTenant } from '../lib/types';

/** App Store製品ページ（ASCアプリID 6787006154）。アプリ公開後に SHOW_APP_STORE_LINK を true へ（§24）。 */
const APP_STORE_URL = 'https://apps.apple.com/jp/app/id6787006154';
const SHOW_APP_STORE_LINK = false;

type NavItem = { path: string; label: string; flag?: 'enable_bottle_keep' | 'enable_vouchers' };

const NAV_ITEMS: NavItem[] = [
  { path: 'reservations', label: '予約台帳' },
  { path: 'schedule', label: '受付設定' },
  { path: 'casts', label: 'キャスト' },
  { path: 'orders', label: 'オーダー履歴' },
  { path: 'menu', label: 'メニュー管理' },
  { path: 'sales', label: '売上管理' },
  { path: 'payroll', label: '給与計算' },
  { path: 'attendance', label: '勤怠管理' },
  { path: 'expenses', label: '経費・収支' },
  { path: 'customers', label: '顧客管理' },
  { path: 'cast-performance', label: 'キャスト成績' },
  { path: 'events', label: 'イベント' },
  { path: 'bottle-keep', label: 'ボトルキープ', flag: 'enable_bottle_keep' },
  { path: 'vouchers', label: '回数券・クーポン券', flag: 'enable_vouchers' },
  { path: 'shift-image', label: 'シフト表作成' },
  { path: 'billing', label: '料金プラン' },
  { path: 'settings', label: '機能設定' },
];

export function AdminLayout({ tenant }: { tenant: KyTenant }) {
  const handleLogout = async () => {
    if (!window.confirm('ログアウトしますか？')) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn('[kyasuho] signOut failed:', error.message);
    }
  };

  return (
    <div className="admin-root">
      <aside className="admin-sidebar">
        <div className="admin-brand">きゃすりん</div>
        <div className="admin-brand-sub">店舗管理（PC版）</div>
        {NAV_ITEMS.filter((item) => !item.flag || tenant[item.flag]).map((item) => (
          <NavLink
            key={item.path}
            to={`/admin/${item.path}`}
            className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
        <div className="admin-sidebar-footer">
          {SHOW_APP_STORE_LINK ? (
            <a
              className="admin-appstore-link"
              href={APP_STORE_URL}
              target="_blank"
              rel="noreferrer"
            >
              アプリで予約通知を受け取る
            </a>
          ) : null}
          スマホでの操作は
          <br />
          「きゃすりん」アプリをご利用ください。
        </div>
      </aside>
      <main className="admin-main">
        <div className="admin-header">
          <div className="admin-shop-name">{tenant.name}</div>
          <div className="admin-header-actions">
            <button type="button" className="admin-btn" onClick={() => void handleLogout()}>
              ログアウト
            </button>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
