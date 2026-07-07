import { useState } from 'react';
import type { KyTenant } from '../lib/types';
import { updateTenantFlags } from './adminApi';

export function AdminSettings({
  tenant,
  onTenantUpdate,
}: {
  tenant: KyTenant;
  onTenantUpdate: (patch: Partial<KyTenant>) => void;
}) {
  const [busy, setBusy] = useState(false);

  const toggle = async (flag: 'enable_bottle_keep' | 'enable_vouchers') => {
    const newVal = !tenant[flag];
    setBusy(true);
    try {
      await updateTenantFlags(tenant.id, { [flag]: newVal });
      onTenantUpdate({ [flag]: newVal });
    } catch {
      window.alert('設定の更新に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="admin-page-title">機能設定</h2>

      <div className="admin-card">
        <div className="admin-section-title" style={{ margin: '0 0 12px' }}>
          オプション機能
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          ONにすると左メニューに管理画面が追加されます。
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={tenant.enable_bottle_keep}
              disabled={busy}
              onChange={() => void toggle('enable_bottle_keep')}
              style={{ width: 18, height: 18 }}
            />
            <span>
              <strong>ボトルキープ管理</strong>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>
                お客様のボトルキープを預かり日・期限・残量で管理できます。
              </span>
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={tenant.enable_vouchers}
              disabled={busy}
              onChange={() => void toggle('enable_vouchers')}
              style={{ width: 18, height: 18 }}
            />
            <span>
              <strong>回数券・チェキ券管理</strong>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>
                回数券やチェキ券の発行・使用回数の管理ができます。
              </span>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
